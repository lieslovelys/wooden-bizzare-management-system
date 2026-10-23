import { describe, it, expect } from 'vitest';
import { taskStatusClass, projectStatusClass } from './status';

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

// ARCHITECTURE_REVIEW.md item 49 — the upcoming-projects dashboard widget colors `projects.status`
// (Pending/In Progress/Completed), a different enum from task_status above.
describe('projectStatusClass', () => {
  it('maps In Progress to the in-progress modifier', () => {
    expect(projectStatusClass('In Progress')).toBe('wb-status wb-status--in-progress');
  });

  it.each(['Pending', 'Completed', null, undefined, '', 'Some Made-Up Status'])(
    'falls back to neutral for %s',
    (status) => {
      expect(projectStatusClass(status)).toBe('wb-status wb-status--neutral');
    },
  );
});
