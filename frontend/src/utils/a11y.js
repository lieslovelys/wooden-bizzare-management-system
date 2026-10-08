// DESIGN.md §8's deferred accessibility item: a non-<button> element (a <div>/<tr> list row)
// that only has an onClick handler is invisible to keyboard and screen-reader users — it has no
// tab stop and no way to activate it without a pointer. clickableProps() is the one place that
// wires up the role/tabIndex/onKeyDown trio a clickable non-button needs, so every call site gets
// the same behavior instead of a slightly different one-off per screen.
//
// Space is prevented by default because the browser's native behavior for a focused element with
// role="button" is to scroll the page on Space — exactly what a real <button> itself suppresses.
// `e.target === e.currentTarget` matters for rows that contain their own interactive children
// (e.g. a delete button inside a notification row): without it, pressing Enter/Space while focus
// is on that inner control would double-fire — once for the inner control's own handler, once for
// the row's, since the key event bubbles up to the row before this check runs.
export function clickableProps(onActivate) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate(e);
      }
    },
  };
}
