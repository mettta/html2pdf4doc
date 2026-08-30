import { VERSION } from './version.js';
console.info(`[HTML2PDF4DOC] Version:`, VERSION);

import App from './app.js';

const script = document.currentScript;
const dataset = script && script.dataset;

// Holds startup params from the HTML2PDF4DOC's <script src="..."> declaration.
let scriptDatasetParams = {};
let isManualInit = false;

if (!dataset) {
  console.warn(
    `[HTML2PDF4DOC] ⛔ Unable to read parameters from the current <script> tag. ` +
    `Please include the library as a classic <script> (without type="module" and without dynamic injection). ` +
    `Use data-* attributes to pass configuration if needed.`
  );
} else {
  scriptDatasetParams = { ...dataset };
  isManualInit = dataset.init === "manual";
  isManualInit && console.info(`HTML2PDF4DOC in manual initialization mode`);
  !isManualInit && new App(scriptDatasetParams).render();
}

export function init(params = {}) {
  if (!isManualInit) {
    return;
  }

  const app = new App({
    ...scriptDatasetParams,
    // Programmatic params can override the params provided via <script src... data...>
    ...params,
  });
  return app.render();
}
