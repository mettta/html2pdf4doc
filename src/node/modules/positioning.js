// 🧭 positioning

import { debugFor } from '../utils/debugFor.js';
const _isDebug = debugFor('positioning');

/**
 * @this {Node}
 */
export function isFirstChildOfFirstChild(element, rootElement) {
  if (!element || !this._DOM.getParentNode(element)) {
    return false;
  }

  let currentElement = element;

  while (this._DOM.getParentNode(currentElement) && currentElement !== rootElement) {
    if (this._DOM.getFirstElementChild(this._DOM.getParentNode(currentElement)) !== currentElement) {
      return false;
    }

    currentElement = this._DOM.getParentNode(currentElement);
  }

  // * Making sure we get to the end,
  // * and don't exit with "false" until the end of the check.
  return currentElement === rootElement;
}

/**
 * @this {Node}
 */
export function isLastChildOfLastChild(element, rootElement) {
  if (!element || !this._DOM.getParentNode(element)) {
    return false;
  }

  let currentElement = element;

  // *** moving up
  while (this._DOM.getParentNode(currentElement) && currentElement !== rootElement) {

    // *** if we're at the root, we move to the right
    if (this._DOM.getParentNode(currentElement) === rootElement) {

      // ! in Pages we inserted an element 'html2pdf4doc-content-flow-end'
      // ! at the end of the content flow.
      // ! Therefore, in the last step of the check, we should not check the last child,
      // ! but the matchings of the nextSibling.
      // ? ...and some plugins like to insert themselves at the end of the body.
      // ? So let's check that stupidity too..
      let _next = this._DOM.getRightNeighbor(currentElement);

      while (!this._DOM.getElementOffsetHeight(_next) && !this._DOM.getElementOffsetWidth(_next)) {
        // *** move to the right
        _next = this._DOM.getRightNeighbor(_next);
        // *** and see if we've reached the end
        if (this.isContentFlowEnd(_next)) {
          return true;
        }
      }
      // *** see if we've reached the end
      return this.isContentFlowEnd(_next);
    }

    // *** and while we're still not at the root, we're moving up
    if (this._DOM.getLastElementChild(this._DOM.getParentNode(currentElement)) !== currentElement) {
      return false;
    }

    currentElement = this._DOM.getParentNode(currentElement);
  }

  // * Making sure we get to the end,
  // * and don't exit with "false" until the end of the check.
  return currentElement === rootElement;
}

/**
 * @this {Node}
 */
export function isVerticalDrop(first, second) {
  // * (-1): Browser subpixel rounding fix.
  const firstBottom = this._DOM.getElementOffsetBottom(first);
  const secondTop = this._DOM.getElementOffsetTop(second);
  const delta = secondTop - firstBottom;
  const vert = delta > (-2);
  _isDebug(this) && console.log('%c isVerticalDrop?', "font-weight:bold", vert,
    '\n delta', delta,
    '\n firstBottom', firstBottom, [first],
    '\n secondTop', secondTop, [second],
  );
  return vert;
}

/**
 * @this {Node}
 */
export function setInitStyle(on, rootNode, rootComputedStyle) {
  const INIT_POS_SELECTOR = '[init-position]';
  const INIT_ALI_SELECTOR = '[init-vertical-align]';
  const UTILITY_POS = 'relative';
  const UTILITY_ALI = 'top';

  const _rootComputedStyle = rootComputedStyle
    ? rootComputedStyle
    : this._DOM.getComputedStyle(rootNode);

  const initPositionValue = _rootComputedStyle.position;
  const initVerticalAlignValue = _rootComputedStyle.verticalAlign;

  if (on) {
    // set
    if (initPositionValue != UTILITY_POS) {
      this._DOM.setStyles(rootNode, { 'position': UTILITY_POS });
      this._DOM.setAttribute(rootNode, INIT_POS_SELECTOR, initPositionValue);
    }
    if (initVerticalAlignValue != UTILITY_ALI) {
      this._DOM.setStyles(rootNode, { 'vertical-align': UTILITY_ALI });
      this._DOM.setAttribute(rootNode, INIT_ALI_SELECTOR, initVerticalAlignValue);
    }
  } else {
    // back
    // * We need to return exactly the value (backPosition & backVerticalAlign),
    // * not just delete the utility value (like { position: '' }),
    // * because we don't store the data, where exactly the init value was taken from,
    // * and maybe it's not in CSS and it's not inherited -
    // * and it's overwritten in the tag attributes.
    const backPosition = this._DOM.getAttribute(rootNode, INIT_POS_SELECTOR);
    const backVerticalAlign = this._DOM.getAttribute(rootNode, INIT_ALI_SELECTOR);
    if (backPosition) {
      this._DOM.setStyles(rootNode, { position: backPosition });
      this._DOM.removeAttribute(rootNode, INIT_POS_SELECTOR);
    }
    if (backVerticalAlign) {
      this._DOM.setStyles(rootNode, { 'vertical-align': backVerticalAlign });
      this._DOM.removeAttribute(rootNode, INIT_ALI_SELECTOR);
    }
  }
}

/**
 * Resolves the given element to a descendant that actually participates in the
 * normal document flow (has an offset parent). Hidden wrappers (display:none,
 * visibility:collapse, position:fixed) are treated as non-flow and return null.
 * Flow-only wrappers (display:contents) are traversed according to the preferred
 * direction.
 *
 *
 * It is the helper that walks down through “transparent” wrappers (e.g. display:contents)
 * until it finds a node that actually has layout geometry (offsetParent).
 *
 * The prefer option controls where to descend when the current node has multiple children:
 * * prefer: 'self' (default) –
 *   only unwrap if the current element is a thin wrapper;
 *   once we reach a child that owns a box, we stop.
 * * prefer: 'first' –
 *   follow the first element child in each wrapper layer.
 *   Useful when we’re looking for the leading edge of a chain
 *   (e.g., climbing up through first-child wrappers).
 * * prefer: 'last' –
 *   follow the last element child instead, so we land on whatever contributes
 *   the trailing edge (used when inspecting previous siblings in tail logic).
 *
 * @param {Element} element - Starting element.
 * @param {Object} [options]
 * @param {('self'|'first'|'last')} [options.prefer='self'] - When traversal is
 *        needed (e.g. display:contents), chooses which child should be inspected.
 * @returns {Element|null} element that owns a layout box, or null if no such box exists.
 */
export function resolveFlowBoxElement(element, { prefer = 'self' } = {}) {
  if (!element) return null;

  const pickChild = (node) => {
    if (prefer === 'last') {
      return this._DOM.getLastElementChild(node);
    }
    if (prefer === 'first' || prefer === 'self') {
      return this._DOM.getFirstElementChild(node);
    }
    return null;
  };

  const visited = new Set();
  let current = element;

  while (current && !visited.has(current)) {
    visited.add(current);

    const offsetParent = this._DOM.getElementOffsetParent(current);
    if (offsetParent) {
      return current;
    }

    const style = this._DOM.getComputedStyle(current);
    if (!style) {
      return null;
    }

    if (this.shouldSkipFlowElement(current, { context: 'resolveFlowElement', computedStyle: style })) {
      return null;
    }

    if (style.display === 'contents') {
      const next = pickChild.call(this, current);
      if (!next) {
        return null;
      }
      current = next;
      continue;
    }

    // The element has no offset parent and is not a flow wrapper.
    // Treat it as non-flow to avoid incorrect measurements.
    return null;
  }

  return null;
}
