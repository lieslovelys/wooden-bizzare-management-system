import React from 'react';

// Shared by globals/JobOrderDetails.jsx's "Mark as Completed" confirmation,
// worker/WorkerJobOrderDetail.jsx's "Submit Work?" confirmation, and
// globals/ProjectVerificationDetail.jsx's repair-reason prompt (FR-6) — a third near-identical
// copy of the same `wb-modal-overlay`/`wb-modal-box` markup was the point at which it became a
// shared component rather than a fourth (track-A plan, commit 3). `children` renders between the
// body text and the action buttons, so a caller that needs more than a yes/no confirmation (the
// repair-reason textarea) can add it without a special-case prop.
const ConfirmModal = ({
  title,
  text,
  children,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmDisabled = false,
}) => (
  <div className="wb-modal-overlay">
    <div className="wb-modal-box">
      <h3 className="wb-modal-title">{title}</h3>
      {text && <p className="wb-modal-text">{text}</p>}
      {children}
      <div className="wb-modal-actions">
        <button className="wb-btn-no" onClick={onCancel}>{cancelLabel}</button>
        <button className="wb-btn-yes" onClick={onConfirm} disabled={confirmDisabled}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmModal;
