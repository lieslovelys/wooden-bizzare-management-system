import { describe, it, expect, vi } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDialog } from './useDialog';

function TestDialog({ open, onClose, useInitialFocus }) {
  const initialFocusRef = useRef(null);
  const dialogRef = useDialog({ open, onClose, initialFocusRef: useInitialFocus ? initialFocusRef : undefined });

  if (!open) return null;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true">
      <button>First</button>
      <input ref={initialFocusRef} aria-label="Middle input" />
      <button>Last</button>
    </div>
  );
}

function Harness({ open: initialOpen, useInitialFocus }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open trigger</button>
      <TestDialog open={open} onClose={() => setOpen(false)} useInitialFocus={useInitialFocus} />
    </div>
  );
}

describe('useDialog', () => {
  it('focuses the first focusable element on open, with no initialFocusRef given', () => {
    render(<TestDialog open onClose={vi.fn()} />);
    expect(screen.getByText('First')).toHaveFocus();
  });

  it('focuses initialFocusRef instead, when given', () => {
    render(<TestDialog open onClose={vi.fn()} useInitialFocus />);
    expect(screen.getByLabelText('Middle input')).toHaveFocus();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<TestDialog open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('wraps Tab from the last focusable element back to the first', () => {
    render(<TestDialog open onClose={vi.fn()} />);
    screen.getByText('Last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByText('First')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    render(<TestDialog open onClose={vi.fn()} />);
    expect(screen.getByText('First')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Last')).toHaveFocus();
  });

  it('returns focus to whatever opened the dialog, once it closes', () => {
    render(<Harness open={false} />);
    const trigger = screen.getByText('Open trigger');
    trigger.focus();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    expect(screen.getByText('First')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
});
