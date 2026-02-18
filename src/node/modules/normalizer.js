// 🪩 normalizer

import { debugFor } from '../utils/debugFor.js';
const _isDebug = debugFor('normalizer');


/*
  Case:
  - We zero margin-top on the first element of each page.
  - Page content length is measured from that element’s top without its margin-top.
  - If a nested first-child’s margin-top collapses outward, it pushes the parent down
    from the “zero” line and starts contributing to content height,
    which causes overflow when building the preview.
    We must prevent that.

  Goal:
  Zero the first child’s margin-top only when it is safe,
  without breaking parent’s internal layout
  (i.e., without changing the position of the children relative to the parent).
  Exact margin-collapse detection is expensive, so we use geometry heuristics.

  Principle:
  Use offsets in one coordinate system. Compare child.top and parent.top.

  Approach:
  Collapse can propagate through a chain of nested first-children.
  We walk down while child.top == parent.top. If child.top > parent.top, collapse is impossible,
  so we stop and do not zero further.

  Heuristics (offsets, single coordinate system):
  - `child.top == parent.top`  => collapse is possible => zero.
  - `child.top > parent.top`   => no collapse (internal offset) => do NOT zero
                                  and stop checking deeper children.

  Assumptions / exceptions / TODOs (for `child.top == parent.top`):
  - No negative margins.
  - No compensating shifts (position: relative or transform).
  - Conservative rule: avoid breaking layout over catching every collapse.
*/


/**
 * @this {Node}
 */
export function getTopCollapseChain(node, root) {
  if (!node || !root) {
    return [];
  }

  const topCache = new Map();
  const getTopCached = (element) => {
    if (!element) {
      return undefined;
    }
    if (topCache.has(element)) {
      return topCache.get(element);
    }
    const top = this.getTop(element, root);
    topCache.set(element, top);
    return top;
  };

  const stopFn = (child, parent) => {
    const childTop = getTopCached(child);
    const parentTop = getTopCached(parent);
    if (childTop === undefined || parentTop === undefined) {
      return true;
    }
    return childTop !== parentTop;
  };

  // Skip floats here so the collapse chain follows the next in-flow sibling.
  return this.getFirstChildrenChain(node, stopFn, { skipFloat: true });
}

/**
 * @this {Node}
 */
export function getBottomCollapseChain(node, root) {
  if (!node || !root) {
    return [];
  }

  const bottomCache = new Map();
  const getBottomCached = (element) => {
    if (!element) {
      return undefined;
    }
    if (bottomCache.has(element)) {
      return bottomCache.get(element);
    }
    const bottom = this.getBottom(element, root);
    bottomCache.set(element, bottom);
    return bottom;
  };

  const stopFn = (child, parent) => {
    const childBottom = getBottomCached(child);
    const parentBottom = getBottomCached(parent);
    if (childBottom === undefined || parentBottom === undefined) {
      return true;
    }
    return childBottom !== parentBottom;
  };

  // Skip floats here so the collapse chain follows the previous in-flow sibling.
  return this.getLastChildrenChain(node, stopFn, { skipFloat: true });
}
