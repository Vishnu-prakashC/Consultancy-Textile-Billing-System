/**
 * Bootstrap: expose TemplateEngine, SpatialExtractor (debug), and ValidationModule on window for script.js.
 */
import { extractData, detectTemplate, extractDataWithWords } from "./TemplateEngine.js";
import { getDebugZones } from "./SpatialExtractor.js";
import * as InvoiceValidation from "./ValidationModule.js";

window.TemplateEngine = { extractData, detectTemplate, extractDataWithWords };
window.SpatialExtractor = { getDebugZones };
window.InvoiceValidation = InvoiceValidation;
