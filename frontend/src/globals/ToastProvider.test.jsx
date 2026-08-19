import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ToastProvider from './ToastProvider';
import { useToast } from '../context/ToastContext';

// Consumer that lets tests trigger showToast() via a button click, matching how every real call
// site uses the hook.
const Consumer = () => {
  const showToast = useToast();
  return (
    <div>
      <button onClick={() => showToast('First message', 'success')}>show-first</button>
      <button onClick={() => showToast('Second message', 'error')}>show-second</button>
    </div>
  );
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('shows a toast on showToast() and auto-dismisses after 3 seconds', () => {
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('show-first'));
    expect(screen.getByText('First message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('First message')).not.toBeInTheDocument();
  });

  it('a second toast fired before the first dismisses gets its own full 3s window', () => {
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('show-first'));
    act(() => {
      vi.advanceTimersByTime(2000); // first toast has 1s left on its timer
    });

    fireEvent.click(screen.getByText('show-second'));
    expect(screen.getByText('Second message')).toBeInTheDocument();

    // If the second toast's timer had been left running instead of reset, the original timer
    // would fire here (at the 1s-remaining mark) and prematurely dismiss it.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Second message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000); // completes the second toast's own 3s window
    });
    expect(screen.queryByText('Second message')).not.toBeInTheDocument();
  });
});
