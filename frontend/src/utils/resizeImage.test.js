import { describe, it, expect, vi, afterEach } from 'vitest';
import { resizeImageToDataUrl } from './resizeImage';

// jsdom implements neither createImageBitmap nor real canvas rendering — both are stubbed here
// rather than pulled in via the `canvas` npm package, since what's under test is
// resizeImageToDataUrl's own guard/scaling logic, not a real decode/re-encode pipeline.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubImageBitmap(width, height) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }));
  return close;
}

function stubCanvas() {
  const fillRect = vi.fn();
  const drawImage = vi.fn();
  const ctx = { fillStyle: null, fillRect, drawImage };
  const toDataURL = vi.fn(() => 'data:image/jpeg;base64,RESIZED');
  const fakeCanvas = { width: 0, height: 0, getContext: () => ctx, toDataURL };
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => (
    tag === 'canvas' ? fakeCanvas : realCreateElement(tag)
  ));
  return { ctx, fakeCanvas, drawImage, toDataURL };
}

describe('resizeImageToDataUrl — guards', () => {
  it('rejects a non-image file without ever calling createImageBitmap', async () => {
    const bitmapSpy = vi.fn();
    vi.stubGlobal('createImageBitmap', bitmapSpy);
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    await expect(resizeImageToDataUrl(file)).rejects.toThrow(/image file/);
    expect(bitmapSpy).not.toHaveBeenCalled();
  });

  it('rejects a file with no type at all', async () => {
    const file = new File(['x'], 'mystery', { type: '' });
    await expect(resizeImageToDataUrl(file)).rejects.toThrow(/image file/);
  });

  it('rejects a file over the raw-size guard before decoding it', async () => {
    const bitmapSpy = vi.fn();
    vi.stubGlobal('createImageBitmap', bitmapSpy);
    const file = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 });
    await expect(resizeImageToDataUrl(file)).rejects.toThrow(/too large/);
    expect(bitmapSpy).not.toHaveBeenCalled();
  });
});

describe('resizeImageToDataUrl — happy path', () => {
  it('downscales a landscape image to fit maxSide, preserving aspect ratio', async () => {
    stubImageBitmap(2000, 1000);
    const { fakeCanvas, drawImage, toDataURL } = stubCanvas();

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await resizeImageToDataUrl(file, { maxSide: 512, quality: 0.8 });

    expect(fakeCanvas.width).toBe(512);
    expect(fakeCanvas.height).toBe(256);
    expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ width: 2000, height: 1000 }), 0, 0, 512, 256);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(result).toBe('data:image/jpeg;base64,RESIZED');
  });

  it('never upscales an image already smaller than maxSide', async () => {
    stubImageBitmap(200, 100);
    const { fakeCanvas } = stubCanvas();

    const file = new File(['x'], 'small.png', { type: 'image/png' });
    await resizeImageToDataUrl(file, { maxSide: 512 });

    expect(fakeCanvas.width).toBe(200);
    expect(fakeCanvas.height).toBe(100);
  });

  it('fills a white background before drawing, so PNG transparency does not go black', async () => {
    stubImageBitmap(100, 100);
    const { ctx } = stubCanvas();

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    await resizeImageToDataUrl(file);

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('closes the bitmap once done', async () => {
    const close = stubImageBitmap(100, 100);
    stubCanvas();

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    await resizeImageToDataUrl(file);

    expect(close).toHaveBeenCalled();
  });
});
