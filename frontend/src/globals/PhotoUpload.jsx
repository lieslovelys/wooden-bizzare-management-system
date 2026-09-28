import React from 'react';
import { useToast } from '../context/ToastContext';
import { resizeImageToDataUrl } from '../utils/resizeImage';

// The profile-picture preview + upload control, byte-identical between AddWorkerModal and
// EditWorkerModal apart from the input id and button label. See ARCHITECTURE_REVIEW.md P2,
// "Near-identical components maintained as separate copies."
//
// PRD.md C.2 "Storage discipline": the picked file is resized/re-encoded client-side (see
// utils/resizeImage.js) before it ever becomes the data URL `onChange` receives, so the backend's
// 512KB cap (backend/src/utils/photoStorage.js) is a formality in practice, not something a
// worker's phone-camera photo routinely trips.
const PhotoUpload = ({ previewUrl, onChange, inputId, label }) => {
  const showToast = useToast();

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      onChange(dataUrl);
    } catch (error) {
      showToast(error.message || 'Could not process that image.', 'error');
    }
  };

  return (
    <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
      <div className="profile-picture-upload">
        {previewUrl ? (
          <img src={previewUrl} alt="Profile Preview" className="profile-preview" />
        ) : (
          <div className="profile-placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        )}
        <label htmlFor={inputId} className="upload-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          {label}
        </label>
        <input
          type="file"
          id={inputId}
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default PhotoUpload;
