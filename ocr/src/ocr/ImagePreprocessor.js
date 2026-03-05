/**
 * ImagePreprocessor.js — OCR-oriented image preprocessing.
 * Simple mode: grayscale only (matches exact invoice pipeline).
 * Advanced mode: grayscale → contrast → sharpen → noise reduction → brightness normalize; optional deskew.
 */

/**
 * Load image from File, Blob, or data URL into an Image element.
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
 * Simple preprocess: grayscale only. Accepts already-loaded Image or loads from File/Blob/URL.
 * Same as your exact pipeline: canvas → drawImage → getImageData → gray = 0.3*r+0.59*g+0.11*b → putImageData → return canvas.
 * @param {HTMLImageElement|File|Blob|string} img - Image element, file, blob, or URL
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function preprocessImage(img, options = {}) {
  const image = await loadImage(img);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.3 * r + 0.59 * g + 0.11 * b;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);

  // Advanced pipeline (optional): contrast, sharpen, noise reduction, brightness
  if (options.advanced) {
    applyContrast(data, options.contrastFactor ?? 1.4);
    ctx.putImageData(imageData, 0, 0);
    applySharpen(imageData);
    ctx.putImageData(imageData, 0, 0);
    if (options.noiseReduction !== false) {
      applyNoiseReduction(imageData);
      ctx.putImageData(imageData, 0, 0);
    }
    applyBrightnessNormalize(data);
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

function applyContrast(data, factor) {
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

