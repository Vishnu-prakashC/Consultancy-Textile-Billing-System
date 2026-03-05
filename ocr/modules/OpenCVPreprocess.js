/**
 * OpenCVPreprocess.js — Production-style preprocessing for camera invoice photos.
 * Perspective correction → Deskew → Noise removal → Adaptive threshold.
 * Uses global cv (OpenCV.js). When cv is not loaded, returns the input canvas unchanged.
 * Used by the main app (script.js) before region crop and OCR to improve accuracy.
 */

function correctPerspective(srcCanvas) {
  if (typeof cv === "undefined") return srcCanvas;
  const src = cv.imread(srcCanvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  let maxArea = 0;
  let bestIdx = -1;
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area > maxArea) {
      maxArea = area;
      bestIdx = i;
    }
  }
  const output = document.createElement("canvas");
  if (bestIdx >= 0) {
    const cnt = contours.get(bestIdx);
    const rect = cv.boundingRect(cnt);
    const x = Math.max(0, rect.x);
    const y = Math.max(0, rect.y);
    const w = Math.min(rect.width, src.cols - x);
    const h = Math.min(rect.height, src.rows - y);
    if (w > 10 && h > 10) {
      const roi = src.roi(new cv.Rect(x, y, w, h));
      const cropped = roi.clone();
      roi.delete();
      output.width = w;
      output.height = h;
      cv.imshow(output, cropped);
      cropped.delete();
    } else {
      cv.imshow(output, src);
    }
  } else {
    cv.imshow(output, src);
  }
  src.delete();
  gray.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();
  return output;
}

function deskew(canvas) {
  if (typeof cv === "undefined") return canvas;
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const coords = new cv.Mat();
  cv.findNonZero(gray, coords);
  let angle = 0;
  if (coords.rows > 0 && coords.cols > 0) {
    const rotatedRect = cv.minAreaRect(coords);
    angle = rotatedRect.angle;
    if (angle < -45) angle += 90;
    if (Math.abs(angle) < 0.5) angle = 0;
  }
  coords.delete();
  gray.delete();
  if (Math.abs(angle) < 0.5) {
    const out = document.createElement("canvas");
    out.width = src.cols;
    out.height = src.rows;
    cv.imshow(out, src);
    src.delete();
    return out;
  }
  const center = new cv.Point(src.cols / 2, src.rows / 2);
  const M = cv.getRotationMatrix2D(center, angle, 1);
  const dst = new cv.Mat();
  cv.warpAffine(src, dst, M, new cv.Size(src.cols, src.rows), cv.INTER_CUBIC, cv.BORDER_REPLICATE);
  const out = document.createElement("canvas");
  out.width = src.cols;
  out.height = src.rows;
  cv.imshow(out, dst);
  src.delete();
  dst.delete();
  M.delete();
  return out;
}

function cleanNoise(canvas) {
  if (typeof cv === "undefined") return canvas;
  const src = cv.imread(canvas);
  const dst = new cv.Mat();
  cv.GaussianBlur(src, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  cv.imshow(output, dst);
  src.delete();
  dst.delete();
  return output;
}

function applyThreshold(canvas) {
  if (typeof cv === "undefined") return canvas;
  const src = cv.imread(canvas);
  let gray;
  if (src.channels() > 1) {
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  } else {
    gray = src.clone();
  }
  src.delete();
  const thresh = new cv.Mat();
  cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  cv.imshow(output, thresh);
  gray.delete();
  thresh.delete();
  return output;
}

/**
 * Run full OpenCV preprocessing: perspective → deskew → noise → adaptive threshold.
 * Call only when isAvailable() is true. Returns a new canvas; original is not modified.
 * @param {HTMLCanvasElement} canvas - Input canvas (e.g. 2x upscaled invoice image)
 * @returns {HTMLCanvasElement} Preprocessed canvas (or same if cv unavailable)
 */
export function runOpenCVPreprocess(canvas) {
  if (typeof cv === "undefined") return canvas;
  try {
    let current = correctPerspective(canvas);
    current = deskew(current);
    current = cleanNoise(current);
    current = applyThreshold(current);
    return current;
  } catch (e) {
    console.warn("[OpenCVPreprocess] failed, using original:", e.message);
    return canvas;
  }
}

/**
 * Check if OpenCV.js is loaded and ready.
 * @returns {boolean}
 */
export function isAvailable() {
  return typeof cv !== "undefined";
}

  /**
   * Wait for OpenCV.js to be loaded (e.g. script is async or WASM still loading). Polls until cv is defined or timeout.
   * Also sets window.cv from Module.cv when OpenCV uses Emscripten Module.
   * @param {number} timeoutMs - Max wait in ms (default 20000)
   * @returns {Promise<boolean>} true if cv is available, false on timeout
   */
export function waitForOpenCV(timeoutMs = 20000) {
  if (typeof cv !== "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (typeof cv !== "undefined") {
        clearInterval(t);
        resolve(true);
        return;
      }
      if (typeof Module !== "undefined" && Module.cv) {
        try {
          window.cv = Module.cv;
          clearInterval(t);
          resolve(true);
          return;
        } catch (e) {}
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        resolve(false);
      }
    }, 250);
  });
}
