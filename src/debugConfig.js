const debugConfig = {
  DOM: {
    _: false,
  },
  layout: {
    _: false,
  },
  pages: {
    _: false,
    // * `Pages` methods
    _parseNode: false,
    _parseNodes: false,
    _registerPageStart: false,
  },
  paper: {
    _: false,
  },
  preview: {
    _: false,
  },
  toc: {
    _: false,
  },
  // * `Node` group
  node: {
    _: false,
    // * `Node` modules
    children: false,
    creators: false,
    flowFilters: false,
    fitters: false,
    getters: false,
    markers: false,
    media: false,
    normalizer: false,
    pageBreaks: false,
    positioning: false,
    selectors: false,
    selectorHeuristics: false,
    slicers: false,
    splitters: false,
    wrappers: false,
    // * `pagination` modules
    pagination: false,
  },
  paragraph: {
    _: false,
  },
  grid: {
    _: false,
  },
  pre: {
    _: false,
  },
  table: {
    _: false,
  },
  tableLike: {
    _: false,
  },
  // * `TEST` group
  testSignals: {
    forcedModeLog: false, // * keep always false
  },
};

// * Clones the debug matrix but forces every flag to true for global troubleshooting.
function enableAllDebugFlags(configSection) {
  const result = Array.isArray(configSection) ? [] : {};

  Object.entries(configSection).forEach(([key, value]) => {
    if (value && typeof value === 'object') {
      result[key] = enableAllDebugFlags(value);
    } else {
      result[key] = true;
    }
  });

  return result;
}

export { enableAllDebugFlags };
export default debugConfig;
