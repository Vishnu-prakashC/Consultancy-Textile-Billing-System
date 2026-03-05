/**
 * Bootstrap: expose TemplateEngine, SpatialExtractor (debug), ImagePreprocessor, and ValidationModule on window for script.js.
 */
import { extractData, detectTemplate, extractDataWithWords, extractDataFromRegions } from "./TemplateEngine.js";
import { getDebugZones } from "./SpatialExtractor.js";
import { preprocessImage, cropRegions, NEW_GOOD_NITS_LAYOUT } from "./ImagePreprocessor.js";
import * as InvoiceValidation from "./ValidationModule.js";

window.TemplateEngine = { extractData, detectTemplate, extractDataWithWords, extractDataFromRegions };
window.SpatialExtractor = { getDebugZones };
window.ImagePreprocessor = { preprocessImage, cropRegions, NEW_GOOD_NITS_LAYOUT };
window.InvoiceValidation = InvoiceValidation;
