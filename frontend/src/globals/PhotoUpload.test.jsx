import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhotoUpload from './PhotoUpload';

// resizeImageToDataUrl (utils/resizeImage.js) has its own full test coverage — mocked here since
// what's under test is PhotoUpload's own wiring: does it call the resizer, forward the result to
// onChange, and toast on failure.
vi.mock('../utils/resizeImage', () => ({
  resizeImageToDataUrl: vi.fn(),
}));
const { resizeImageToDataUrl } = await import('../utils/resizeImage');

describe('PhotoUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the placeholder icon and the given label when no preview is set', () => {
    render(<PhotoUpload previewUrl={null} onChange={vi.fn()} inputId="upload" label="Upload Photo" />);
    expect(screen.queryByAltText('Profile Preview')).not.toBeInTheDocument();
    expect(screen.getByText('Upload Photo')).toBeInTheDocument();
  });

  it('renders the preview image when previewUrl is set', () => {
    render(<PhotoUpload previewUrl="data:image/png;base64,xyz" onChange={vi.fn()} inputId="upload" label="Change Photo" />);
    expect(screen.getByAltText('Profile Preview')).toHaveAttribute('src', 'data:image/png;base64,xyz');
  });

  it('resizes the selected file and calls onChange with the result', async () => {
    resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,RESIZED');
    const handleChange = vi.fn();
    render(<PhotoUpload previewUrl={null} onChange={handleChange} inputId="upload" label="Upload Photo" />);

    const file = new File(['content'], 'worker.png', { type: 'image/png' });
    const input = document.getElementById('upload');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(handleChange).toHaveBeenCalledWith('data:image/jpeg;base64,RESIZED'));
    expect(resizeImageToDataUrl).toHaveBeenCalledWith(file);
  });

  it('does nothing when the file input is cleared with no file', () => {
    const handleChange = vi.fn();
    render(<PhotoUpload previewUrl={null} onChange={handleChange} inputId="upload" label="Upload Photo" />);

    const input = document.getElementById('upload');
    fireEvent.change(input, { target: { files: [] } });

    expect(resizeImageToDataUrl).not.toHaveBeenCalled();
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when the resize rejects (a toast fires instead, via useToast)', async () => {
    resizeImageToDataUrl.mockRejectedValue(new Error('Please choose an image file.'));
    const handleChange = vi.fn();
    render(<PhotoUpload previewUrl={null} onChange={handleChange} inputId="upload" label="Upload Photo" />);

    const file = new File(['content'], 'notes.txt', { type: 'text/plain' });
    const input = document.getElementById('upload');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(resizeImageToDataUrl).toHaveBeenCalled());
    expect(handleChange).not.toHaveBeenCalled();
  });
});
