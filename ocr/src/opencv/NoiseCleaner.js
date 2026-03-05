/**
 * NoiseCleaner.js — Reduce paper texture and background noise with Gaussian blur.
 * Uses OpenCV.js GaussianBlur(5x5). Light blur keeps text readable while smoothing noise.
 */

/**
 * Clean noise (paper texture, surface) with a light Gaussian blur.
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @returns {HTMLCanvasElement} Smoothed canvas
 */
export function cleanNoise(canvas) {
  if (typeof cv === "undefined") return canvas;

  const src = cv.imread(canvas);
  const dst = new cv.Mat();

  cv.GaussianBlur(
    src,
    dst,
    new cv.Size(5, 5),
    0,
    0,
    cv.BORDER_DEFAULT
  );

  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  cv.imshow(output, dst);

  src.delete();
  dst.delete();

  return output;
}
