/**
 * TrainedLayouts.js — Pre-trained or averaged layouts (y, h format). Load from JSON or use defaults.
 */

const TRAINED_LAYOUTS_KEY = 'trained_layouts';

// Default layout (fallback)
export const DEFAULT_NEW_GOOD_NITS_LAYOUT = {
  header: { y: 0, h: 0.17 },
  customer: { y: 0.18, h: 0.16, x: 0, w: 0.6 },
  billMeta: { y: 0.18, h: 0.16, x: 0.6, w: 0.4 },
  table: { y: 0.36, h: 0.4 },
  totals: { y: 0.78, h: 0.14 }
};

// Load trained layouts from storage
let trainedLayouts = loadTrainedLayouts();

/**
 * Load trained layouts from localStorage
 * @returns {Object} Trained layouts object
 */
function loadTrainedLayouts() {
  try {
    const stored = localStorage.getItem(TRAINED_LAYOUTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load trained layouts:', error);
    return {};
  }
}

/**
 * Save trained layout to storage
 * @param {string} templateId - Template identifier
 * @param {Object} layout - Trained layout object
 */
export function saveTrainedLayout(templateId, layout) {
  trainedLayouts[templateId] = layout;
  try {
    localStorage.setItem(TRAINED_LAYOUTS_KEY, JSON.stringify(trainedLayouts));
    console.log(`Trained layout saved for ${templateId}`);
  } catch (error) {
    console.error('Failed to save trained layout:', error);
  }
}

/**
 * Get trained layout by template id. Returns trained layout if available, otherwise default.
 * @param {string} templateId - e.g. "NEW_GOOD_NITS"
 * @returns {Object|null}
 */
export function getTrainedLayout(templateId) {
  return trainedLayouts[templateId] || DEFAULT_NEW_GOOD_NITS_LAYOUT;
}

/**
 * Check if a trained layout exists for the given template
 * @param {string} templateId - Template identifier
 * @returns {boolean}
 */
export function hasTrainedLayout(templateId) {
  return !!trainedLayouts[templateId];
}

/**
 * Clear all trained layouts (reset to defaults)
 */
export function clearTrainedLayouts() {
  trainedLayouts = {};
  localStorage.removeItem(TRAINED_LAYOUTS_KEY);
}
