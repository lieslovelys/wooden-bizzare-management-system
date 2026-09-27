// FR-5 (PRD.md C.1 / B.6): every attendance row has sat at the database default ('Absent', 0
// late/overtime minutes) regardless of the times entered, since nothing ever computed them.
// services/attendanceService.js now computes `status`/`late_minutes` on every future insert/
// update (see its WORKING_HOURS constants for the rules) — this migration applies that same
// formula once, as a backfill, to every row that already exists.
//
// Deliberately inlined as raw SQL rather than importing attendanceService's computeAttendance:
// a migration is a historical snapshot of "what this backfill did," and must keep working exactly
// as written even if the app's rules change later.
//
// Rules (shift 08:30-17:00, 15-min grace, lunch 12:00-13:00 excluded from worked time):
//   - no time_in                                -> Absent, 0
//   - time_in and time_out, worked < 4h         -> Half-day, 0 (checked before Late)
//   - time_in > 08:45                           -> Late, minutes past 08:30
//   - otherwise                                 -> Present, 0
// A legacy row with time_out <= time_in (nonsensical under the `time`-typed, no-date-part
// columns) is judged on time_in alone, same as a row with no time_out at all.
//
// Overtime is deliberately left untouched (still 0 for every row) — the client hasn't specified
// that rule yet, so attendanceService doesn't compute it either.
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    UPDATE attendance
    SET
      status = CASE
        WHEN time_in IS NULL THEN 'Absent'
        WHEN time_out IS NOT NULL AND time_out > time_in
             AND (EXTRACT(EPOCH FROM (time_out - time_in)) / 60
                  - GREATEST(0, EXTRACT(EPOCH FROM (
                      LEAST(time_out, TIME '13:00') - GREATEST(time_in, TIME '12:00')
                    )) / 60)
                 ) < 240
          THEN 'Half-day'
        WHEN time_in > TIME '08:45' THEN 'Late'
        ELSE 'Present'
      END,
      late_minutes = CASE
        WHEN time_in IS NULL THEN 0
        WHEN time_out IS NOT NULL AND time_out > time_in
             AND (EXTRACT(EPOCH FROM (time_out - time_in)) / 60
                  - GREATEST(0, EXTRACT(EPOCH FROM (
                      LEAST(time_out, TIME '13:00') - GREATEST(time_in, TIME '12:00')
                    )) / 60)
                 ) < 240
          THEN 0
        WHEN time_in > TIME '08:45'
          THEN EXTRACT(EPOCH FROM (time_in - TIME '08:30')) / 60
        ELSE 0
      END;
  `);
};

// Restores exactly the pre-FR-5 state: nothing ever wrote these columns before, so every row was
// at the schema default.
export const down = (pgm) => {
  pgm.sql(`UPDATE attendance SET status = 'Absent', late_minutes = 0;`);
};
