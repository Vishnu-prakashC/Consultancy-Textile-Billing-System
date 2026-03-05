/**
 * Deskew.js — Rotate image so document is horizontal (corrects camera angle).
 * Uses OpenCV.js: findNonZero → minAreaRect → rotation matrix → warpAffine.
 */

/**
 * Deskew the document so text is horizontal.
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @returns {HTMLCanvasElement} Rotated canvas
 */
export function deskew(canvas) {
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
    const output = document.createElement("canvas");
    output.width = src.cols;
    output.height = src.rows;
    cv.imshow(output, src);
    src.delete();
    return output;
  }

  const center = new cv.Point(src.cols / 2, src.rows / 2);
  const M = cv.getRotationMatrix2D(center, angle, 1);
  const dst = new cv.Mat();

  cv.warpAffine(
    src,
    dst,
    M,
    new cv.Size(src.cols, src.rows),
    cv.INTER_CUBIC,
    cv.BORDER_REPLICATE
  );

  const output = document.createElement("canvas");
  output.width = src.cols;
  output.height = src.rows;
  cv.imshow(output, dst);

  src.delete();
  dst.delete();
  M.delete();

  return output;
}
