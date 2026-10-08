import { useEffect, useRef } from 'react';

// DESIGN.md §8's deferred accessibility item: none of the app's modals/drawers handled Escape or
// managed focus at all — opening one left focus wherever it already was (often behind the
// overlay), and nothing ever moved it back on close. This is the one place that behavior lives,
// so every dialog in the app gets the same handling instead of a slightly different one-off per
// screen.
//
// `dialogRef` goes on the dialog's own box element (the thing with role="dialog"), not the
// overlay — that's what bounds the Tab-trap and what gets searched for an element to focus.
// `initialFocusRef`, when given, is focused first on open (e.g. a textarea that should be ready to
// type into); otherwise the first focusable element inside the dialog is used.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialog({ open, onClose, initialFocusRef }) {
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;

    const focusTarget = initialFocusRef?.current
      ?? dialogRef.current?.querySelector(FOCUSABLE_SELECTOR);
    focusTarget?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // The element that opened this dialog may itself have been removed (e.g. a deleted row's
      // own "delete" button) — only restore focus to something still in the document.
      if (previouslyFocusedRef.current && document.contains(previouslyFocusedRef.current)) {
        previouslyFocusedRef.current.focus();
      }
    };
    // onClose/initialFocusRef are deliberately excluded below: re-running this effect on every
    // render (which an unstable onClose/initialFocusRef would cause) would re-focus the dialog and
    // fight the user's own tabbing. Callers are expected to keep them stable across a single
    // open/close cycle, same assumption ConfirmModal's existing onConfirm/onCancel props make.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return dialogRef;
}
