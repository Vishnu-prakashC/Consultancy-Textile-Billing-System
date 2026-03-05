/**
 * training/index.js — Template learning entry point.
 * Use trainTemplate(images, { preprocess, runOCR }) then exportLayoutAsJson(layout) or downloadLayoutAsJson(layout) to save as templates/NEW_GOOD_NITS_LAYOUT.json.
 */

export { trainTemplate, trainAndExport, exportLayoutAsJson, downloadLayoutAsJson } from "./TemplateTrainer.js";
export { detectAnchors } from "./AnchorDetector.js";
export { computeLayoutFromAnchors, averageLayouts } from "./LayoutCalculator.js";
