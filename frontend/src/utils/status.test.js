import { describe, it, expect } from 'vitest';
import { taskStatusClass } from './status';

describe('taskStatusClass', () => {
  it.each([
    ['Assigned', 'wb-status wb-status--assigned'],
    ['In Progress', 'wb-status wb-status--in-progress'],
    ['For QA', 'wb-status wb-status--for-qa'],
    ['Approved', 'wb-status wb-status--approved'],
    ['Repair', 'wb-status wb-status--repair'],
  ])('maps %s to %s', (status, expected) => {
    expect(taskStatusClass(status)).toBe(expected);
  });

  it('maps Rework onto the same modifier as Repair', () => {
    expect(taskStatusClass('Rework')).toBe('wb-status wb-status--repair');
  });

  it.each([null, undefined, '', 'Unknown', 'Some Made-Up Status'])(
    'falls back to neutral for %s',
    (status) => {
      expect(taskStatusClass(status)).toBe('wb-status wb-status--neutral');
    },
  );
});
