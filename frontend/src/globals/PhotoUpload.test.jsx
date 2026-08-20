import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoUpload from './PhotoUpload';

// jsdom's FileReader doesn't actually decode file contents, so it's replaced with a minimal
// synchronous stub for the one behavior this component depends on: reading a File and firing
// onloadend with a base64 `result`.
class FakeFileReader {
  readAsDataURL(file) {
    this.result = `data:${file.type};base64,FAKE(${file.name})`;
    this.onloadend?.();
  }
}

describe('PhotoUpload', () => {
  let originalFileReader;

  beforeEach(() => {
    originalFileReader = window.FileReader;
    window.FileReader = FakeFileReader;
  });

  afterEach(() => {
    window.FileReader = originalFileReader;
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

  it('calls onChange with the base64 result when a file is selected', () => {
    const handleChange = vi.fn();
    render(<PhotoUpload previewUrl={null} onChange={handleChange} inputId="upload" label="Upload Photo" />);

    const file = new File(['content'], 'worker.png', { type: 'image/png' });
    const input = document.getElementById('upload');
    fireEvent.change(input, { target: { files: [file] } });

    expect(handleChange).toHaveBeenCalledWith('data:image/png;base64,FAKE(worker.png)');
  });

  it('does nothing when the file input is cleared with no file', () => {
    const handleChange = vi.fn();
    render(<PhotoUpload previewUrl={null} onChange={handleChange} inputId="upload" label="Upload Photo" />);

    const input = document.getElementById('upload');
    fireEvent.change(input, { target: { files: [] } });

    expect(handleChange).not.toHaveBeenCalled();
  });
});
