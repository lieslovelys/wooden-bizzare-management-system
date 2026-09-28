import React, { useId } from 'react';

// Shared by globals/JobOrderDetails.jsx's "Mark as Completed" confirmation,
// worker/WorkerJobOrderDetail.jsx's "Submit Work?" confirmation,
// globals/ProjectVerificationDetail.jsx's repair-reason prompt (FR-6), and — since the
// native-dialog replacement pass (ARCHITECTURE_REVIEW.md item 26) — every delete/destructive
// confirmation that used to be a bespoke `wb-modal-overlay`/`wb-modal-box` copy
// (admin/AccountList.jsx, globals/Attendance.jsx) or a native `window.confirm`
// (globals/ProjectList.jsx, globals/InventoryTable.jsx, globals/NotificationList.jsx).
// `children` renders between the body text and the action buttons, so a caller that needs more
// than a yes/no confirmation (the repair-reason textarea) can add it without a special-case prop.
// `danger` marks a destructive action (delete) with the same red styling those bespoke copies
// used to hardcode via inline `style` — see css/globals.css's `.danger` rules next to the other
// `.wb-*` modal rules.
const ConfirmModal = ({
  title,
  text,
  children,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmDisabled = false,
  danger = false,
}) => {
  const titleId = useId();
  return (
    <div className="wb-modal-overlay">
      <div className="wb-modal-box" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 id={titleId} className={`wb-modal-title${danger ? ' danger' : ''}`}>{title}</h3>
        {text && <p className="wb-modal-text">{text}</p>}
        {children}
        <div className="wb-modal-actions">
          <button className="wb-btn-no" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`wb-btn-yes${danger ? ' danger' : ''}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
