/**
 * Bootstrap: expose TemplateEngine and ValidationModule on window for script.js.
 */
import { extractData, detectTemplate } from "./TemplateEngine.js";
import * as InvoiceValidation from "./ValidationModule.js";

window.TemplateEngine = { extractData, detectTemplate };
window.InvoiceValidation = InvoiceValidation;
