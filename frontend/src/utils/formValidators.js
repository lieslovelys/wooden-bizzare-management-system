// Shared form-input rules — the digit-strip behavior was copy-pasted across 3 components
// (AddWorkerModal, EditWorkerModal, CreateProjectForm/EditProjectForm) and the contact-number
// completeness check across 2 (AddWorkerModal, EditWorkerModal), and they'd already drifted:
// both worker modals block submit on a short contact number, but neither project form checked at
// all. See ARCHITECTURE_REVIEW.md P2, "Near-identical components maintained as separate copies."

export const CONTACT_NUMBER_LENGTH = 11;
export const CONTACT_NUMBER_ERROR = 'Contact number must be exactly 11 digits.';

// Strips digits from a name field (Bawal ang numbers sa pangalan).
export function withoutDigits(value) {
  return value.replace(/[0-9]/g, '');
}

// Strips non-digits and rejects (returns undefined) once the result would exceed maxLength —
// matches the existing "further typing is simply blocked" behavior of the four components this
// replaces, rather than silently truncating what the user typed.
export function digitsOnly(value, maxLength = CONTACT_NUMBER_LENGTH) {
  const onlyNumbers = value.replace(/[^0-9]/g, '');
  return onlyNumbers.length <= maxLength ? onlyNumbers : undefined;
}

// True when a non-empty contact number hasn't reached the required length — the shared
// pre-submit guard in AddWorkerModal/EditWorkerModal. A contact number is allowed to be blank
// (Edit doesn't require one); if present, it must be complete.
export function isIncompleteContactNumber(value, length = CONTACT_NUMBER_LENGTH) {
  return Boolean(value) && value.length < length;
}
