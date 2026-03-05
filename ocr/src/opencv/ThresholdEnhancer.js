/**
 * ThresholdEnhancer.js — Adaptive threshold to make faint text clear for OCR.
 * Uses OpenCV.js ADAPTIVE_THRESH_GAUSSIAN_C. Critical for camera photos with uneven lighting.
 */

/**
 * Apply adaptive threshold (binarize) so text stands out from background.
 * @param {HTMLCanvasElement} canvas - Input canvas (grayscale or color)
 * @returns {HTMLCanvasElement} Binary canvas (black text on white)
 */
export function applyThreshold(canvas) {
  if (typeof cv === "undefined") return canvas;

  const src = cv.imread(canvas);
  const gray = new cv.Mat();

  if (src.channels() > 1) {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  } else {
    gray = src.clone();
  }

  const thresh = new cv.Mat();
  cv.adaptiveThreshold(
    gray,
    thresh,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    11,
    2
  );

  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  cv.imshow(output, thresh);

  src.delete();
  gray.delete();
  thresh.delete();

  return output;
}
