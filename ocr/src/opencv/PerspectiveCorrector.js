/**
 * PerspectiveCorrector.js — Find document contour and crop to bounding rect (removes tilt/background).
 * Uses OpenCV.js: Canny edges → findContours → largest contour → boundingRect → crop.
 * Call only when cv is loaded (e.g. after opencv.js script ready).
 */

/**
 * Correct perspective by detecting the document (largest contour) and cropping to its bounding rectangle.
 * @param {HTMLCanvasElement} srcCanvas - Input canvas (e.g. from preprocessImage)
 * @returns {HTMLCanvasElement} Canvas containing only the document region
 */
export function correctPerspective(srcCanvas) {
  if (typeof cv === "undefined") return srcCanvas;

  const src = cv.imread(srcCanvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

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
