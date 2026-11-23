import SELECTOR, { withLegacySelector } from './selector.js';

// * Length options, converted to px below.
// * They are kept out of the string-to-boolean conversion,
// * so that "0" and "1" stay lengths.
const LENGTH_KEYS = [
  'printLeftMargin',
  'printRightMargin',
  'printTopMargin',
  'printBottomMargin',
  'printFontSize',
  'paperWidth',
  'paperHeight',
  'headerMargin',
  'footerMargin',
  'virtualPagesGap',
];

export default function createConfig(params) {

  // * Normalize string booleans in config object
  // * (e.g. "true" → true)
  params = convertStringBools(params, LENGTH_KEYS);

  // ? used in style.js
  let config = {
    // * Debug mode is set in the user configuration.
    // * In the case of connecting the script in HTML without configuration
    // * in order to display messages in the browser console,
    // * this option can be set to true:
    debugMode: false,
    forcedDebugMode: false,
    // ** The preloader is only debugged when enabled via user configuration.

    // * Assert messages are enabled in the user settings by the parameter
    // * data-console-assert="true".
    // * By default is disabled.
    consoleAssert: false,

    // * Visual marks on processed DOM elements (affects performance)
    // * are enabled in user settings using the parameter
    // * data-markup-debug-mode=“true”.
    // * Disabled by default.
    // * Note: internal logic uses flag storage/registries; DOM attributes are for debug only.
    markupDebugMode: false,

    // * Resource waiting timeout in milliseconds.
    resourceTimeoutMs: 2000,

    // Register option to print for informational purposes:
    preloader: false,
    preloaderTarget: '',
    preloaderBackground: '',

    mask: true,

    // * The initialRoot can be overridden in the configuration settings.
    // * The default value is set in App.js.
    // * The selector '[html2pdf4doc]' is a constant from SELECTOR (selector.js).
    // * Uncommenting it will have no effect.
    // * This comment is provided for better code navigation.
    // * Left for code navigation purposes.
    // initialRoot: '[html2pdf4doc]', // TODO: make the config dependent on SELECTOR

    noHangingSelectors: '',
    forcedPageBreakSelectors: '',
    pageBreakBeforeSelectors: '',
    pageBreakAfterSelectors: '',
    noBreakSelectors: '',

    // toc
    tocPageNumberSelector: 'html2pdf4doc-toc-page-number', // TODO: make the config dependent on SELECTOR

    // print
    printLeftMargin: '21mm',
    printRightMargin: '21mm',
    printTopMargin: '12mm',
    printBottomMargin: '12mm',
    printFontSize: '12pt', // todo 16+ // 1:18px 2:36px 3:54px
    // misc
    paperColor: 'white',
    // print A4 default
    paperWidth: '210mm', // todo <170
    paperHeight: '297mm', // todo ~400
    // html template
    headerMargin: '16px',
    footerMargin: '16px',
    // virtual
    virtualPagesGap: '16px',

    // * service elements:
    splitLabelHeight: '24px'
  }

  const A4 = {
    paperWidth: '210mm', // todo <170
    paperHeight: '297mm', // todo ~400
  }

  const A5 = {
    paperWidth: '148.5mm', // todo <170
    paperHeight: '210mm', // todo ~400
  }

  // * Can be specified by a shorthand entry,
  // * and then can be partially or completely overridden
  // * by specifying paperWidth and paperHeight.
  // TODO
  // ? landscape | portrait
  switch (params.printPaperSize) {
    case 'A5':
    case 'a5':
      config = {
        ...config,
        ...A5
      };
      break;
    case 'A4':
    case 'a4':
    default:
      config = {
        ...config,
        ...A4
      };
  }

  // * Fallback values for length options that the browser rejects.
  const defaults = config;

  // * Apply the defaults and custom configuration
  // * extracted from the script attributes from the DOM.
  config = {
    // Parameters affect the base config,
    ...config,

    // definition of the selector for the default printable area
    // as specified in the SELECTOR,
    initialRoot: withLegacySelector(SELECTOR.init),
    tocPageNumberSelector: withLegacySelector(SELECTOR.tocPageNumber),

    // and then also redefine the base config.
    ...params
  }

  console.info('[HTML2PDF4DOC] Config:', config);

  // * Convert units to pixels
  const measurement = Object.fromEntries(
    LENGTH_KEYS.map(key => [key, config[key]])
  );

  const test = document.createElement('div');
  test.style = `
  position:absolute;
  z-index:1000;
  left: 200%;
  `;
  document.body.append(test);

  Object.entries(measurement)
    .forEach(([key, value]) => {
      // * Reset the width first: the browser ignores an invalid width,
      // * and the element would keep the width of the previous option.
      test.style.width = '';
      test.style.width = toCssLength(value);
      if (test.style.width === '') {
        console.warn(
          `[HTML2PDF4DOC] Config option "${key}" has an invalid length "${value}". Using the default "${defaults[key]}".`
        );
        test.style.width = toCssLength(defaults[key]);
      }
      measurement[key] = `${Math.trunc(test.getBoundingClientRect().width)}px`;
    });
  test.remove();

  // * Update config with recalculated measurement
  config = {
    ...config,
    ...measurement
  };

  // * Add default page-breaking selectors selectors
  // * for to nicely divide the elements of a document:
  config.noHangingSelectors = config.noHangingSelectors + ' H1 H2 H3 H4 H5 H6';
  config.forcedPageBreakSelectors = config.forcedPageBreakSelectors + ' ' + withLegacySelector(SELECTOR.printForcedPageBreak);
  // config.pageBreakBeforeSelectors = '';
  // config.pageBreakAfterSelectors = '';
  // config.noBreakSelectors = '';

  config.debugMode && console.info('Config with converted units:', config);

  return config;
}

// * Temporary helper to remap deprecated dimension keys.
// * Can be removed once legacy config options are fully dropped.
export function normalizeLegacyConfigParams(rawParams = {}) {
  const normalized = { ...rawParams };

  [
    ['printWidth', 'paperWidth', 'data-print-width', 'data-paper-width'],
    ['printHeight', 'paperHeight', 'data-print-height', 'data-paper-height'],
  ].forEach(([deprecatedKey, nextKey, deprecatedAttr, nextAttr]) => {
    if (Object.prototype.hasOwnProperty.call(normalized, deprecatedKey)) {
      console.warn(
        `[HTML2PDF4DOC] Config option "${deprecatedAttr}" is deprecated. Use "${nextAttr}" instead.`
      );

      if (!Object.prototype.hasOwnProperty.call(normalized, nextKey)) {
        normalized[nextKey] = normalized[deprecatedKey];
      }

      delete normalized[deprecatedKey];
    }
  });

  return normalized;
}

/**
 * Returns a CSS length for a length option.
 * A number or a unitless numeric string, for example "0" or "16", is read as px.
 *
 * @param {string|number} value
 * @returns {string}
 */
function toCssLength(value) {
  if (typeof value === 'number' || /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(value)) {
    return `${parseFloat(value)}px`;
  }
  return value;
}

/**
 * Returns a copy of the object where string values
 * that clearly represent boolean values ("true", "false", "1", "0", "")
 * are converted to true or false.
 *
 * Conversion rules:
 *   - "true", "1" (case-insensitive) → true
 *   - "false", "0", "" (case-insensitive) → false
 *   - all other values (including numbers and other strings) are left unchanged
 *   - the original object is not modified
 *
 * @param {Object} obj — the input object
 * @param {string[]} [skipKeys] — keys whose values are left unchanged
 * @returns {Object} — a new object with normalized boolean values
 */
function convertStringBools(obj, skipKeys = []) {
  const result = { ...obj };

  for (const key in result) {
    if (skipKeys.includes(key)) continue;
    const value = result[key];

    if (typeof value === "string") {
      const lowered = value.toLowerCase();

      if (lowered === "true" || lowered === "1") {
        result[key] = true;
      } else if (lowered === "false" || lowered === "0" || lowered === "") {
        result[key] = false;
      }
    }
  }

  return result;
}
