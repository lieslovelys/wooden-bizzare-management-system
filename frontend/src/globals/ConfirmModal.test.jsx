import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from './ConfirmModal';

// FR-6: globals/ProjectVerificationDetail.jsx's repair-reason prompt is the third caller of this
// shared modal (see the component's own comment) and the reason its `confirmDisabled` prop
// exists — a Repair without a reason 400s server-side (jobOrderService.updateQAStatus), so the
// client must not be able to submit an empty one.

describe('ConfirmModal', () => {
  it('renders the title and body text', () => {
    render(<ConfirmModal title="Complete Project?" text="Are you sure?" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Complete Project?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onCancel and onConfirm from their respective buttons', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmModal title="Submit Work?" confirmLabel="Yes, Submit" onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Yes, Submit'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders children between the body text and the action buttons', () => {
    render(
      <ConfirmModal title="Send Back for Repair?" onCancel={vi.fn()} onConfirm={vi.fn()}>
        <textarea placeholder="Reason" />
      </ConfirmModal>
    );
    expect(screen.getByPlaceholderText('Reason')).toBeInTheDocument();
  });

  it('disables the confirm button when confirmDisabled is true, and does not fire onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal title="Send Back for Repair?" confirmLabel="Send" confirmDisabled onCancel={vi.fn()} onConfirm={onConfirm} />
    );
    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
    fireEvent.click(sendButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('enables the confirm button once confirmDisabled is false', () => {
    render(<ConfirmModal title="Send Back for Repair?" confirmLabel="Send" confirmDisabled={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Send')).not.toBeDisabled();
  });

  it('exposes a dialog role naming the title, for screen readers and for tests', () => {
    render(<ConfirmModal title="Delete Account?" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete Account?' });
    expect(dialog).toBeInTheDocument();
  });

  it('calls onCancel on Escape (useDialog)', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal title="Delete Account?" onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('focuses Cancel (the first focusable element) by default', () => {
    render(<ConfirmModal title="Delete Account?" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Cancel')).toHaveFocus();
  });

  it('applies the danger class to the title and confirm button when danger is set', () => {
    render(<ConfirmModal danger title="Delete Account?" confirmLabel="Yes, Delete" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Delete Account?')).toHaveClass('danger');
    expect(screen.getByText('Yes, Delete')).toHaveClass('danger');
  });

  it('omits the danger class by default', () => {
    render(<ConfirmModal title="Mark as Completed?" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Mark as Completed?')).not.toHaveClass('danger');
    expect(screen.getByText('Yes')).not.toHaveClass('danger');
  });
});
