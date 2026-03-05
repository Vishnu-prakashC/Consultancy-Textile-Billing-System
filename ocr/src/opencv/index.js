/**
 * opencv/index.js — OpenCV pipeline and readiness check.
 * Ensures cv is loaded before running OpenCV steps (script loads async).
 */

import { correctPerspective } from "./PerspectiveCorrector.js";
import { cleanNoise } from "./NoiseCleaner.js";
import { applyThreshold } from "./ThresholdEnhancer.js";
import { deskew } from "./Deskew.js";

export { correctPerspective } from "./PerspectiveCorrector.js";
export { cleanNoise } from "./NoiseCleaner.js";
export { applyThreshold } from "./ThresholdEnhancer.js";
export { deskew } from "./Deskew.js";

/**
 * Run full OpenCV preprocessing: perspective → deskew → noise → threshold.
 * Skips any step if cv is not loaded; returns the last canvas from the previous step.
 * @param {HTMLCanvasElement} canvas
 * @returns {HTMLCanvasElement}
 */
export function opencvPreprocess(canvas) {
  if (typeof cv === "undefined") return canvas;
  let current = canvas;
  try {
    current = correctPerspective(current);
    current = deskew(current);
    current = cleanNoise(current);
    current = applyThreshold(current);
  } catch (e) {
    console.warn("[OpenCV] preprocessing failed, using previous step:", e.message);
  }
  return current;
}

/**
 * Resolve when OpenCV.js is ready (cv defined). Polls until cv is available or timeout.
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
export function waitForOpencv(timeoutMs = 15000) {
  if (typeof cv !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (typeof cv !== "undefined") {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("OpenCV.js load timeout"));
      }
    }, 100);
  });
}
