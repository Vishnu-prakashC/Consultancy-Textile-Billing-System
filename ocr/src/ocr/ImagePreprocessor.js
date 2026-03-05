/**
 * ImagePreprocessor.js — Production image preprocessing for OCR accuracy.
 * Pipeline: grayscale → contrast → sharpen → noise reduction → brightness normalize.
 * Optional deskew. Uses HTML Canvas; returns processed canvas.
 */

/**
 * Load image from File, Blob, or data URL into an Image element.
 * @param {HTMLImageElement|File|Blob|string} source
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(source) {
  if (source instanceof HTMLImageElement && source.complete && source.naturalWidth) {
    return Promise.resolve(source);
  }
  return new Promise((resolve, reject) => {
    const img = source instanceof HTMLImageElement ? source : new Image();
    let urlToRevoke = null;
    img.onload = () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      resolve(img);
    };
    img.onerror = () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      reject(new Error("Image load failed"));
    };
    if (source instanceof HTMLImageElement && source.src) {
      img.src = source.src;
    } else if (source instanceof File) {
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
 * Convert image data to grayscale (luminance weights).
 */
function applyGrayscale(data) {
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = Math.round(g);
  }
}

/**
 * Increase contrast around midpoint (128).
 */
function applyContrast(data, factor = 1.4) {
  const mid = 128;
  for (let i = 0; i < data.length; i += 4) {
    const g = data[i];
    const out = mid + (g - mid) * factor;
    const c = Math.max(0, Math.min(255, Math.round(out)));
    data[i] = data[i + 1] = data[i + 2] = c;
  }
}

/**
 * 3x3 sharpen kernel (center 5, neighbors -1).
 */
function applySharpen(imageData) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i];
  const w = width;
  const h = height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const c = data[idx];
      const t = data[((y - 1) * w + x) * 4];
      const b = data[((y + 1) * w + x) * 4];
      const l = data[(y * w + (x - 1)) * 4];
      const r = data[(y * w + (x + 1)) * 4];
      const v = Math.max(0, Math.min(255, c * 5 - t - b - l - r));
      out[idx] = out[idx + 1] = out[idx + 2] = v;
    }
  }
  for (let i = 0; i < data.length; i++) data[i] = out[i];
}

/**
 * Simple noise reduction: 3x3 box blur (light pass).
 */
function applyNoiseReduction(imageData) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i];
  const w = width;
  const h = height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          sum += data[((y + dy) * w + (x + dx)) * 4];
      const v = Math.round(sum / 9);
      const idx = (y * w + x) * 4;
      out[idx] = out[idx + 1] = out[idx + 2] = v;
    }
  }
  for (let i = 0; i < data.length; i++) data[i] = out[i];
}

/**
 * Normalize brightness: scale so average is near 128.
 */
function applyBrightnessNormalize(data) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
    n++;
  }
  const avg = n ? sum / n : 128;
  if (avg < 1) return;
  const scale = 128 / avg;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(data[i] * scale)));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/**
 * Preprocess image for OCR. Returns a new canvas with the processed image.
 * @param {HTMLImageElement|File|Blob|string} image - Input image (element, file, blob, or URL)
 * @param {Object} options - { contrastFactor, skipNoiseReduction, skipDeskew }
 * @returns {Promise<HTMLCanvasElement>} Processed canvas
 */
export async function preprocessImage(image, options = {}) {
  const {
    contrastFactor = 1.4,
    skipNoiseReduction = false,
    skipDeskew = true
  } = options;

  const img = await loadImage(image);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  let imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  applyGrayscale(data);
  applyContrast(data, contrastFactor);
  applySharpen(imageData);
  if (!skipNoiseReduction) applyNoiseReduction(imageData);
  applyBrightnessNormalize(data);

  ctx.putImageData(imageData, 0, 0);

  // Optional deskew: would require line detection; skipped by default
  if (!skipDeskew && typeof deskew === "function") {
    // Placeholder: if deskew(canvas) is provided elsewhere, call it
  }

  return canvas;
}
