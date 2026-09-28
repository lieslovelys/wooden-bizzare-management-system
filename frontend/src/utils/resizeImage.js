// Client-side resize for worker photo uploads — PRD.md C.2 "Storage discipline". Shrinks
// whatever the user picked down to a small JPEG before it ever leaves the browser, so the
// backend's 512KB cap (backend/src/utils/photoStorage.js) almost never actually gets hit and the
// upload itself stays fast even on a shop-floor connection. Used by globals/PhotoUpload.jsx.

// Guards against decoding something absurd before createImageBitmap even gets a chance to try —
// a raw multi-hundred-MB "image" (or a mislabeled non-image) should fail fast with a clear
// message rather than hang the tab.
const MAX_RAW_BYTES = 20 * 1024 * 1024;

// Returns a Promise<string> resolving to a `data:image/jpeg;base64,...` URL, resized so neither
// dimension exceeds `maxSide` (aspect ratio preserved, never upscaled). Rejects with a plain
// Error carrying a user-facing message for globals/PhotoUpload.jsx to toast.
export async function resizeImageToDataUrl(file, { maxSide = 512, quality = 0.85 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new Error('That image is too large — please choose a smaller file.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // White background first — a transparent PNG would otherwise flatten to black once drawn
    // into a JPEG canvas, which has no alpha channel of its own.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    // Only ImageBitmap instances expose close() (releases the decoded pixel buffer promptly
    // rather than waiting for GC) — guarded since some test/polyfill environments return a
    // plain object instead.
    bitmap.close?.();
  }
}
