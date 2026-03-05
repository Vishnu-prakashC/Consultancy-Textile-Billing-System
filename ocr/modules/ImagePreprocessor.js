/**
 * ImagePreprocessor.js — Improve OCR accuracy by cleaning low-clarity invoice images.
 * Steps: upscale 2x, grayscale, contrast, sharpen, threshold (binarization).
 * preprocessImage(file) returns { blob, dataUrl, originalWidth, originalHeight } for OCR and bbox scaling.
 * cropRegions(blob, width, height) returns region blobs for region-based OCR (NEW GOOD NITS layout).
 */

/** NEW GOOD NITS layout — aligned with template-learning spec (Header 0–18%, Customer 18–35%, Table 35–75%, Totals 75–92%). */
export const NEW_GOOD_NITS_LAYOUT = {
  header:   { top: 0,    bottom: 0.18, left: 0, right: 1 },
  customer: { top: 0.18, bottom: 0.35, left: 0, right: 0.55 },
  billMeta: { top: 0.18, bottom: 0.35, left: 0.52, right: 1 },
  table:    { top: 0.35, bottom: 0.75, left: 0, right: 1 },
  totals:   { top: 0.75, bottom: 0.92, left: 0, right: 1 }
};

/**
 * Load image from File, Blob, or URL; returns Promise<HTMLImageElement>.
 * @param {File|Blob|string} source - File, Blob, or data URL
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let urlToRevoke = null;
    img.onload = () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      resolve(img);
    };
    img.onerror = () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      reject(new Error("Image load failed"));
    };
    if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(source);
    } else if (source instanceof Blob) {
      urlToRevoke = URL.createObjectURL(source);
      img.src = urlToRevoke;
    } else {
      img.src = source;
    }
  });
}

/**
 * Apply grayscale using luminance weights.
 * @param {Uint8ClampedArray} data - RGBA image data (modified in place)
 */
function applyGrayscale(data) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = Math.round(gray);
  }
}

/**
 * Increase contrast by stretching intensity around midpoint.
 * @param {Uint8ClampedArray} data - RGBA image data (modified in place)
 * @param {number} factor - Contrast factor (e.g. 1.2 = 20% more contrast)
 */
function applyContrast(data, factor = 1.3) {
  const mid = 128;
  for (let i = 0; i < data.length; i += 4) {
    const g = data[i];
    const adjusted = mid + (g - mid) * factor;
    const clamped = Math.round(Math.max(0, Math.min(255, adjusted)));
    data[i] = data[i + 1] = data[i + 2] = clamped;
  }
}

/**
 * Simple sharpen using 3x3 kernel (center 5, neighbors -1).
 * @param {ImageData} imageData - Full ImageData (width, height, data)
 */
function applySharpen(imageData) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i];
  }

  const w = width;
  const h = height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const center = data[idx];
      const top = data[((y - 1) * w + x) * 4];
      const bottom = data[((y + 1) * w + x) * 4];
      const left = data[(y * w + (x - 1)) * 4];
      const right = data[(y * w + (x + 1)) * 4];
      const sharp = center * 5 - top - bottom - left - right;
      const clamped = Math.max(0, Math.min(255, sharp));
      out[idx] = out[idx + 1] = out[idx + 2] = clamped;
    }
  }
  for (let i = 0; i < data.length; i++) {
    data[i] = out[i];
  }
}

/**
 * Binarize: pixel > threshold ? 255 : 0.
 * @param {Uint8ClampedArray} data - RGBA image data (modified in place)
 * @param {number} threshold - 0..255
 */
function applyThreshold(data, threshold = 150) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const v = gray > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/**
 * Compute Otsu's threshold from grayscale histogram (R channel after grayscale).
 * Works well for uneven lighting; use instead of fixed threshold for camera photos.
 * @param {Uint8ClampedArray} data - RGBA image data (grayscale: R=G=B)
 * @returns {number} threshold 0..255
 */
function otsuThreshold(data) {
  const hist = new Int32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]]++;
  }
  let total = data.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxV = 0;
  let threshold = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxV) {
      maxV = v;
      threshold = i;
    }
  }
  return Math.max(1, Math.min(254, threshold));
}

/**
 * Preprocess image for OCR: upscale 2x, grayscale, contrast, sharpen, threshold.
 * @param {File} file - Image file (JPEG/PNG)
 * @param {Object} options - Optional: { threshold, contrastFactor, skipBinarize }
 * @returns {Promise<{ blob: Blob, dataUrl: string, originalWidth: number, originalHeight: number }>}
 */
export async function preprocessImage(file, options = {}) {
  const {
    threshold = null,
    contrastFactor = 1.3,
    skipBinarize = false
  } = options;

  const img = await loadImage(file);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  canvas.width = originalWidth * 2;
  canvas.height = originalHeight * 2;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  applyGrayscale(data);
  applyContrast(data, contrastFactor);
  applySharpen(imageData);
  if (!skipBinarize) {
    const th = threshold != null && threshold >= 0 ? threshold : otsuThreshold(data);
    applyThreshold(data, th);
  }
  ctx.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
      0.95
    );
  });

  return {
    blob,
    dataUrl,
    originalWidth,
    originalHeight
  };
}

/** Minimum region size for Tesseract (avoids "Image too small to scale" / "Line cannot be recognized"). */
const MIN_REGION_WIDTH = 40;
const MIN_REGION_HEIGHT = 24;

/**
 * Crop image into regions by layout (fractions 0–1). Used for region-based OCR.
 * Regions smaller than MIN_REGION_* are scaled up so Tesseract receives a viable size.
 * @param {Blob} blob - Preprocessed image blob (e.g. from preprocessImage)
 * @param {number} width - Full image width (e.g. originalWidth * 2 if preprocess upscaled 2x)
 * @param {number} height - Full image height
 * @param {Object} [layout] - Region map; defaults to NEW_GOOD_NITS_LAYOUT
 * @returns {Promise<{ header?: Blob, customer: Blob, billMeta: Blob, table: Blob, totals: Blob }>}
 */
export async function cropRegions(blob, width, height, layout = NEW_GOOD_NITS_LAYOUT) {
  const img = await loadImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const out = {};
  for (const [key, region] of Object.entries(layout)) {
    const sx = Math.round(region.left * width);
    const sy = Math.round(region.top * height);
    let sw = Math.round((region.right - region.left) * width);
    let sh = Math.round((region.bottom - region.top) * height);
    if (sw <= 0 || sh <= 0) continue;

    let outW = sw;
    let outH = sh;
    if (sw < MIN_REGION_WIDTH || sh < MIN_REGION_HEIGHT) {
      const scale = Math.max(
        MIN_REGION_WIDTH / Math.max(1, sw),
        MIN_REGION_HEIGHT / Math.max(1, sh)
      );
      outW = Math.max(MIN_REGION_WIDTH, Math.round(sw * scale));
      outH = Math.max(MIN_REGION_HEIGHT, Math.round(sh * scale));
    }

    const crop = document.createElement("canvas");
    crop.width = outW;
    crop.height = outH;
    const cctx = crop.getContext("2d");
    cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);

    out[key] = await new Promise((resolve, reject) => {
      crop.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
        0.92
      );
    });
  }
  return out;
}
