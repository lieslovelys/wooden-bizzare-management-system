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
});
