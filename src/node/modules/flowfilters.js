// ♻️ flowfilters

import { debugFor } from '../utils/debugFor.js';
const _isDebug = debugFor('flowFilters');

// Cache marker so each element is evaluated at most once per run.
const FLOW_SKIP_FLAG = '__html2pdf4docFlowFilter';
// Cache marker for floats; used by consumers that want to handle floats separately.
const FLOW_FLOAT_FLAG = '__html2pdf4docFloat';

const SKIP_RULES = [
  {
    test: (style) => style.display === 'none',
    cache: {
      reason: 'display:none',
      message: '* display:none — skipped',
    },
  },
  {
    test: (style) => style.position === 'absolute',
    cache: {
      reason: 'position:absolute',
      message: '* position:absolute — skipped',
    },
  },
  {
    test: (style) => style.position === 'fixed',
    cache: {
      reason: 'position:fixed',
      message: '* position:fixed — skipped',
    },
  },
  {
    test: (style) => style.visibility === 'collapse',
    cache: {
      reason: 'visibility:collapse',
      message: '* visibility:collapse — skipped',
    },
  },
  {
    test: (style, element) => {
      if (style.float && style.float !== 'none') {
        // Mark floats without skipping: some paths handle them explicitly later.
        element[FLOW_FLOAT_FLAG] = true;
      }
      return false;
    },
    cache: null,
  },
];

const SKIP_TAGS = new Set([
  'SOURCE',
  'TEMPLATE',
  'SCRIPT',
  'NOSCRIPT',
  'STYLE',
  'LINK',
  'META',
  'HEAD',
  'TITLE',
]);

function logSkip(node, context, cache, element, { cached } = { cached: false }) {
  if (!_isDebug(node)) return;
  const prefix = context ? `(${context}) ` : '';
  const suffix = cached ? ' (cached)' : '';
  console.info(`🚸 ${prefix}${cache.message}${suffix}`, [element]);
}

export function shouldSkipFlowElement(element, { context = '', computedStyle } = {}) {
  if (!element || !this || !this._DOM || !this._DOM.isElementNode(element)) {
    return false;
  }

  // * cached result
  const cached = element[FLOW_SKIP_FLAG];
  if (cached) {
    logSkip(this, context, cached, element, { cached: true });
    return true;
  }

  // * by TAG name
  const tagName = this._DOM.getElementTagName(element);
  if (SKIP_TAGS.has(tagName)) {
    logSkip(this, context, { message: `* <${tagName}> — skipped` }, element);
    return true;
  }

  // * by CSS styles
  const style = computedStyle ?? this._DOM.getComputedStyle(element);
  if (!style) {
    return false;
  }
  for (const rule of SKIP_RULES) {
    if (rule.test(style, element)) {
      element[FLOW_SKIP_FLAG] = rule.cache;
      logSkip(this, context, rule.cache, element);
      return true;
    }
  }

  return false;
}

/**
 * @this {Node}
 */
export function isRegisteredFloatElement(element) {
  return !!element?.[FLOW_FLOAT_FLAG];
}
