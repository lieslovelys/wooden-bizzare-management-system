import { describe, it, expect, vi } from 'vitest';
import { clickableProps } from './a11y';

function fireKeyDown(props, key, overrides = {}) {
  const target = {};
  const event = {
    key,
    target,
    currentTarget: target,
    preventDefault: vi.fn(),
    ...overrides,
  };
  props.onKeyDown(event);
  return event;
}

describe('clickableProps', () => {
  it('sets role=button and a tab stop', () => {
    const props = clickableProps(vi.fn());
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
  });

  it('wires onClick directly to the activate callback', () => {
    const onActivate = vi.fn();
    const props = clickableProps(onActivate);
    props.onClick('click-event');
    expect(onActivate).toHaveBeenCalledWith('click-event');
  });

  it('activates on Enter', () => {
    const onActivate = vi.fn();
    const event = fireKeyDown(clickableProps(onActivate), 'Enter');
    expect(onActivate).toHaveBeenCalledWith(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('activates on Space and prevents the default page scroll', () => {
    const onActivate = vi.fn();
    const event = fireKeyDown(clickableProps(onActivate), ' ');
    expect(onActivate).toHaveBeenCalledWith(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ignores every other key', () => {
    const onActivate = vi.fn();
    fireKeyDown(clickableProps(onActivate), 'Tab');
    fireKeyDown(clickableProps(onActivate), 'ArrowDown');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores a key event that bubbled up from an inner control', () => {
    const onActivate = vi.fn();
    const row = {};
    const innerButton = {};
    fireKeyDown(clickableProps(onActivate), 'Enter', { target: innerButton, currentTarget: row });
    expect(onActivate).not.toHaveBeenCalled();
  });
});
