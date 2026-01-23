/**
 * ============================================================================
 * TEMPLATE CONFIGURATION MODULE
 * ============================================================================
 * 
 * PURPOSE:
 * This module defines company-specific extraction rules for OCR data extraction.
 * Templates allow customization of field detection patterns based on bill format
 * variations across different textile companies.
 * 
 * USAGE:
 * Each company can have a template that specifies:
 * - Customer name extraction rules (e.g., "AFTER:Bill To")
 * - Total amount extraction rules (e.g., "LABEL:Total")
 * - GST extraction rules
 * - Bill number extraction rules
 * 
 * FUTURE EXTENSIBILITY:
 * - Add new templates by extending the templates object
 * - Support regex patterns
 * - Support positional extraction (e.g., "ROW:3, COL:2")
 * - Support ML-based field detection
 * 
 * ============================================================================
 */

const TemplateConfig = {
  /**
   * Available templates for different companies
   */
  templates: {
    'default': {
      company: 'Default Template',
      customerNameRule: 'AFTER:Bill To',
      totalRule: 'LABEL:Total',
      gstRule: 'LABEL:GST',
      billNoRule: 'LABEL:Invoice No',
      dateRule: 'LABEL:Date'
    },
    'new-goo-nits': {
      company: 'New Goo Nits',
      customerNameRule: 'AFTER:Bill To',
      totalRule: 'LABEL:Total',
      gstRule: 'LABEL:GST',
      billNoRule: 'LABEL:Invoice No',
      dateRule: 'LABEL:Date'
    }
  },

  /**
   * Get template configuration for a company
   * @param {string} companyName - Company identifier
   * @returns {Object} Template configuration
   */
  getTemplate(companyName = 'default') {
    return this.templates[companyName] || this.templates['default'];
  },

  /**
   * Add or update a template
   * @param {string} companyName - Company identifier
   * @param {Object} config - Template configuration
   */
  setTemplate(companyName, config) {
    this.templates[companyName] = {
      ...this.templates['default'],
      ...config,
      company: companyName
    };
  }
};
