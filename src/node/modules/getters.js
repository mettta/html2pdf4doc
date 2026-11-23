// 📥 getters

import { debugFor } from '../utils/debugFor.js';
const _isDebug = debugFor('getters');

/**
 * Returns element's top position measured in page-candidate context.
 * Used when evaluating elements as potential page starts.
 *
 * Previously, we used getTopWithMargin().
 * Top margin is excluded since it's reset on new pages now.
 *
 * @this {Node}
 */
export function getTopForPageStartCandidate(element, root) {
  const info = this.getPageStartTopInfo(element, root);
  return info?.top;
}

/**
 * Returns the top position for a page-start candidate and, when applicable,
 * the anchor element used for that measurement.
 *
 * @this {Node}
 */
export function getPageStartTopInfo(element, root) {
  if (!element) {
    return;
  }

  const style = this._DOM.getComputedStyle(element);
  const isContentsWrapper = style?.display === 'contents';
  const isInlineWrapper = !isContentsWrapper && this.isInline(element, style);

  if (isContentsWrapper || isInlineWrapper) {
    // Inline/contents wrappers can be baseline-aligned, so their top may be below
    // the actual visual start of a media/child box. Anchor pageTop to the first
    // real child box (or replaced element) to avoid page starts drifting downward.
    let anchor = this.resolveReplacedElement?.(element, { prefer: 'first' });
    if (!anchor) {
      const flowChildren = this.getFlowChildren?.(element) || [];
      if (flowChildren.length === 1) {
        anchor = flowChildren[0];
      }
    }
    if (anchor && anchor !== element) {
      const anchorTop = this.getTop(anchor, root);
      const wrapperTop = this.getTop(element, root);
      if (anchorTop !== undefined && wrapperTop !== undefined) {
        // Pick the earliest visual edge so wrapper padding/margins don't shift
        // the page start below the actual top of the group.
        return { top: Math.min(anchorTop, wrapperTop), anchor };
      }
      if (anchorTop !== undefined) {
        return { top: anchorTop, anchor };
      }
    }
  }

  const top = this.getTop(element, root);
  return { top, anchor: null };
}

/**
 * Returns offsetTop of element relative to root, normalized by root's padding-top.
 *
 * In layouts like TD, the available height is usually precomputed excluding padding-top.
 * But element.offsetTop starts after padding-top — leading to double-counting it.
 *
 * This function compensates by subtracting padding-top, so positioning aligns
 * with the precomputed height budget.
 *
 * @this {Node}
 */
export function getNormalizedTop(element, root, rootComputedStyle) {
  const _rootComputedStyle = rootComputedStyle ? rootComputedStyle : this._DOM.getComputedStyle(root);
  const rootPaddingTop = parseFloat(_rootComputedStyle.paddingTop) || 0;
  return this.getTop(element, root) - rootPaddingTop;
}

/**
 * Returns offsetBottom (with margins) of element relative to root,normalized by root's padding-top.
 *
 * In layouts like TD, the available height is usually precomputed excluding padding-top.
 * But element.offsetTop starts after padding-top — leading to double-counting it.
 *
 * This function compensates by subtracting padding-top, so positioning aligns
 * with the precomputed height budget.
 *
 * @this {Node}
 */
export function getNormalizedBottomWithMargin(element, root, rootComputedStyle) {
  const _rootComputedStyle = rootComputedStyle ? rootComputedStyle : this._DOM.getComputedStyle(root);
  const rootPaddingTop = parseFloat(_rootComputedStyle.paddingTop) || 0;
  return this.getBottomWithMargin(element, root) - rootPaddingTop;
}

/**
 * Measures `element`’s vertical offset relative to `root` by walking the native
 * `offsetParent` chain:
 * - `element` must be contained in `root`; otherwise the traversal aborts.
 * - Both arguments must be HTMLElements with standard offset behavior.
 * - The algorithm accumulates `offsetTop` while recursing through `offsetParent`
 *   until it hits either `root` itself or the first shared `offsetParent`.
 * - When the shared parent is `document.body`, the result is still computed but
 *   a warning is emitted (missing positioned ancestors).
 * - Encountering a node without `offsetParent` (hidden/fixed/detached) logs the
 *   traversal stack and returns `undefined`.
 *
 * Returned value = (sum of `element` offsets) − (root’s offset relative to the
 * shared ancestor), matching the semantics of `offsetTop` but scoped to `root`.
 *
 * ***
 * Note on “bad” nodes:
 * `offsetParent` becomes `null` if the element is hidden (`display:none`),
 * detached, fixed-positioned, or otherwise outside the normal layout.
 * Such nodes break the offset chain;
 * either skip them or fix their DOM state before calling this function.
 *
 * @this {Node}
 */
export function getTop(element, root = null, topAcc = 0, paramSnapshot = null, traversalStack = [], rootContext = null) {
  if (!element) {
    _isDebug(this) && console.warn(
      '[getTop] element must be provided, but was received:', element,
      '\nThe function returned:', undefined
    );
    return
  }

  if (!(element instanceof HTMLElement)) {
    this.strictAssert(0, '[getTop] element must be HTMLElement, but was received:', element, '\nThe function returned:', undefined);
    return
  }

  if (root === null) {
    return this._DOM.getElementOffsetTop(element)
  }

  if (!(root instanceof HTMLElement)) {
    this.strictAssert(0, '[getTop] root must be HTMLElement, but was received:', root, '\nThe function returned:', undefined);
    return;
  }

  paramSnapshot = paramSnapshot || { element, root };

  // On the very first call ensure the target element belongs to the provided root;
  // otherwise we can't build a meaningful offset chain between them.
  if (topAcc === 0 && !root.contains(element)) {
    this.strictAssert(0, '[getTop] the provided root does not contain the element.',
      { element, root, paramSnapshot },
      '\nThe function returned:', undefined);
    return;
  }

  // Cache shared data about the root we are measuring against:
  // 1) which offsetParent acts as the common reference frame
  // 2) how far the root itself is from that reference frame.
  rootContext = rootContext || _initRootContext.call(this, root, paramSnapshot);
  if (!rootContext) {
    _isDebug(this) && console.warn(
      'Root has no a usable offset reference; nothing else to measure against. \nThe function returned:', undefined,
      { element, paramSnapshot, offsetParent, traversal: nextTraversalStack }
    );
    return;
  }

  // If during recursion we bubbled up to the requested root, we have accumulated
  // the full distance and can exit immediately.
  if (element === root) {
    return topAcc;
  }

  const nextTraversalStack = [...traversalStack, element];
  const offsetParent = this._DOM.getElementOffsetParent(element);

  if (!offsetParent) {
    _isDebug(this) && console.warn(
      'Element has no offset parent; offset chain is broken. \nThe function returned:', undefined,
      { element, paramSnapshot, offsetParent, traversal: nextTraversalStack }
    );
    return
  }

  const currTop = this._DOM.getElementOffsetTop(element);

  if (offsetParent === root) {
    return (currTop + topAcc);
  }

  // If we have reached the same offsetParent the root uses,
  // compare the distance of the element to the distance of the root.
  if (offsetParent === rootContext.sharedOffsetParent) {
    if (rootContext.sharedOffsetParentIsBody && !rootContext.warnedAboutBody) {
      rootContext.warnedAboutBody = true;
      _isDebug(this) && console.warn(
        'getTop(): reached document.body while measuring offsets. Layout likely lacks positioned ancestors.',
        { element, root, paramSnapshot }
      );
    }
    return (currTop + topAcc) - rootContext.rootOffsetFromSharedParent;
  }

  return this.getTop(offsetParent, root, topAcc + currTop, paramSnapshot, nextTraversalStack, rootContext);
}

function _initRootContext(root, paramSnapshot) {
  const sharedOffsetParent = this._DOM.getElementOffsetParent(root);

  if (!sharedOffsetParent) {
    _isDebug(this) && console.warn(
      '[getTop*]: root has no offset parent; cannot build relative offsets.',
      { root, paramSnapshot }
    );
    return null;
  }

  const rootOffsetFromSharedParent = this._DOM.getElementOffsetTop(root);
  if (typeof rootOffsetFromSharedParent !== 'number') {
    _isDebug(this) && console.warn(
      '[getTop*]: root offsetTop is not a number.',
      { root, sharedOffsetParent, paramSnapshot }
    );
    return null;
  }

  return {
    sharedOffsetParent,
    rootOffsetFromSharedParent,
    sharedOffsetParentIsBody: sharedOffsetParent === root.ownerDocument?.body,
    warnedAboutBody: false
  };
}

/**
 * @this {Node}
 */
export function getBottom(element, root = null) {
  if (!element) {
    _isDebug(this) && console.warn(
      '[getBottom] element must be provided, but was received:', element,
      '\nThe function returned:', undefined
    );
    return
  }

  // the offset case
  if (root === null) {
    return this._DOM.getElementOffsetBottom(element)
  }

  if (!root) {
    _isDebug(this) && console.warn(
      'root must be provided, but was received:', root,
      '\nThe function returned:', undefined
    );
    return
  }

  return this.getTop(element, root) + this._DOM.getElementOffsetHeight(element);
}

/**
 * @this {Node}
 */
export function getBottomWithMargin(element, root) {
  // TODO : performance
  // ? However, the performance compared to getBottom() decreases:
  // ? 0.001 to 0.3 ms per such operation.

  // * Because of the possible bottom margin
  // * of the parent element or nested last children,
  // * the exact check will be through the creation of the test element.
  // * (The bottom margin pushes the test DIV below the margin).

  // * However, not all structures give the correct result. For example,
  // * flex or others with vertical rhythm abnormalities.
  // * Therefore, we implement an additional check.

  if (!element) {
    return
  }

  const _elementBottom = this.getBottom(element, root);
  let result;

  const test = this.createNeutralBlock();
  this._DOM.insertAfter(element, test);
  const testTop = this.getTop(test, root);
  this._DOM.removeNode(test);

  // * In case of normal vertical rhythm, the position of the test element
  // * inserted after the current one can only be greater than or equal
  // * to _elementBottom:

  const isTestResultValid = testTop >= _elementBottom;

  if (isTestResultValid) {
    result = testTop;
  } else {
    // * Otherwise, we'll have to use a less accurate but stable method.
    const bottomMargin = parseInt(this._DOM.getComputedStyle(element).marginBottom);
    result = _elementBottom + bottomMargin;
  }
  return result;
}

/**
 * @this {Node}
 */
export function getHeightWithMargin(element) {
  const topMargin = parseInt(this._DOM.getComputedStyle(element).marginTop);
  const bottomMargin = parseInt(this._DOM.getComputedStyle(element).marginBottom);
  const height = this._DOM.getElementOffsetHeight(element);
  return height + topMargin + bottomMargin;
}

/**
 * @this {Node}
 */
export function getTopWithMargin(element, root) {
  // TODO : performance
  const topMargin = parseInt(this._DOM.getComputedStyle(element).marginTop);
  return this.getTop(element, root) - topMargin;
}

/**
 * @this {Node}
 */
export function getMaxWidth(node) {
  // * width adjustment for createTestNodeFrom() from Node
  // ? problem: if the node is inline,
  // it may not show its maximum width in the parent context.
  // So we make a block element that shows
  // the maximum width of the node in the current context:
  const tempDiv = this.create();
  this._DOM.insertAtEnd(node, tempDiv);
  const width = this._DOM.getElementOffsetWidth(tempDiv);
  this._DOM.removeNode(tempDiv);
  return width;
}

/**
 * @this {Node}
 */
export function getEmptyNodeHeightByProbe(node, inner = '', margins = true) {
  // An inner is expected for elements with a specific structure,
  // e.g. “<tr><td></td></td></tr>” for a table.
  const wrapper = this.create();
  margins && this._DOM.setStyles(wrapper, { overflow: 'auto' });
  const clone = this._DOM.cloneNodeWrapper(node);
  this._DOM.setInnerHTML(clone, inner);
  this._DOM.insertAtEnd(wrapper, clone);
  this._DOM.insertBefore(node, wrapper);
  const wrapperHeight = this._DOM.getElementOffsetHeight(wrapper);
  this._DOM.removeNode(wrapper);
  return wrapperHeight;
}

/**
 * @this {Node}
 */
export function getLineHeight(node) {
  const testNode = this.createNeutral();
  // if node has padding, this affects so cant be taken bode clone as wrapper // todo comment
  // const testNode = this._DOM.cloneNodeWrapper(node);
  this._DOM.setInnerHTML(testNode, '!');
  this._DOM.setStyles(testNode, {
    display: 'block',
    // ! 'absolute' added extra height to the element:
    // position: 'absolute',
    // left: '-10000px',
    // width: '100%',
  });

  this._DOM.insertAtEnd(node, testNode);
  const lineHeight = this._DOM.getElementOffsetHeight(testNode);
  this._DOM.removeNode(testNode);
  return lineHeight;
}

/**
 * @this {Node}
 *
 * Create an empty row by cloning the TR, insert it into the table,
 * add the specified number of lines to it (lines),
 * and detect its actual height through the delta
 * of the tops of the TR following it.
 */
export function getTableRowHeight(tr, lines = 0) {
  const initialTop = this._DOM.getElementOffsetTop(tr);
  const clone = this._DOM.cloneNode(tr);
  const text = '!<br />'.repeat(lines);
  [...clone.children].forEach(td => this._DOM.setInnerHTML(td, text));
  this._DOM.insertBefore(tr, clone);
  const endTop = this._DOM.getElementOffsetTop(tr);
  this._DOM.removeNode(clone);
  return endTop - initialTop;
}

/**
 * @this {Node}
 *
 * Create an empty row by cloning the TR, insert it into the table,
 * and detect its actual height through the delta
 * of the tops of the TR following it.
 */
// TODO: not used?
export function getTableEmptyRowHeight(tr) {
  const initialTop = this._DOM.getElementOffsetTop(tr);
  const clone = this._DOM.cloneNodeWrapper(tr);
  this._DOM.insertBefore(tr, clone);
  const endTop = this._DOM.getElementOffsetTop(tr);
  this._DOM.removeNode(clone);
  return endTop - initialTop;
}

/**
 * @this {Node}
 *
 * Measures the visual height of a cloned <tr>
 * when one original <td> (without content) is inserted at a time,
 * while all other <td> elements are replaced with minimal placeholders
 * that aim to minimize their impact on row height.
 *
 * This is used to estimate the structural contribution of each TD
 * (its padding, borders, alignment, etc.)
 * to the overall height of the table row, independent of its content.
 *
 * Returns: number[] — an array of heights, where each value represents
 * the height of the <tr> when the corresponding TD is present
 * (in its original DOM position), and the others are minimized.
 */
export function getTableRowShellHeightByTD(tr) {
  const initialTop = this._DOM.getElementOffsetTop(tr);
  const trClone = this._DOM.cloneNodeWrapper(tr);
  const tdCount = tr.children.length;
  const originalTDs = [...tr.children];

  this._DOM.insertBefore(tr, trClone);

  const trByTdHeights = [];

  for (let i = 0; i < tdCount; i++) {
    const tdPlaceholders = [];

    for (let j = 0; j < tdCount; j++) {
      let td;
      if (j === i) {
        td = this._DOM.cloneNodeWrapper(originalTDs[j]);
        this._DOM.setInnerHTML(td, '');
      } else {
        td = document.createElement('td');
        this._DOM.setInnerHTML(td, '');
        this._DOM.setStyles(td, {
          padding: '0',
          border: 'none',
          verticalAlign: 'top',
          lineHeight: '0',
          minHeight: '0',
          fontSize: '0',
        });
      }
      tdPlaceholders.push(td);
    }

    this._DOM.insertAtEnd(trClone, ...tdPlaceholders);

    const topAfterInsert = this._DOM.getElementOffsetTop(tr);
    const height = topAfterInsert - initialTop;
    trByTdHeights.push(height);

    tdPlaceholders.forEach(td => this._DOM.removeNode(td));
  }

  this._DOM.removeNode(trClone);
  return trByTdHeights;
}

/**
 * @this {Node}
 */
export function getTableEntries(node) {
  if (!(node instanceof HTMLElement) || node.tagName !== 'TABLE') {
    throw new Error('Expected a <table> element.');
  }

  const nodeEntries = [...node.children].reduce((acc, curr) => {
    const tag = curr.tagName;

    if (tag === 'TBODY') {
      return { ...acc, rows: [...acc.rows, ...curr.children] };
    }

    if (tag === 'CAPTION') {
      this.markNoBreak(curr);
      return { ...acc, caption: curr };
    }

    if (tag === 'COLGROUP') {
      this.markNoBreak(curr);
      return { ...acc, colgroup: curr };
    }

    if (tag === 'THEAD') {
      this.markNoBreak(curr);
      return { ...acc, thead: curr };
    }

    if (tag === 'TFOOT') {
      this.markNoBreak(curr);
      return { ...acc, tfoot: curr };
    }

    if (tag === 'TR') {
      // A TR directly inside TABLE, for example in a table built with DOM APIs.
      return { ...acc, rows: [...acc.rows, curr] };
    }

    _isDebug(this) && curr && console.warn('unexpected:', curr);

    return {
      ...acc,
      // The HTML parser keeps some elements directly inside TABLE,
      // for example STYLE, SCRIPT, TEMPLATE and INPUT type=hidden.
      unexpected: [...acc.unexpected, curr],
    };
  }, {
    caption: null,
    thead: null,
    tfoot: null,
    rows: [],
    unexpected: [],
  });

  if (nodeEntries.unexpected.length > 0) {
    _isDebug(this) && console.warn(`something unexpected is found in the table ${node}`);
  }

  return nodeEntries;
}

/**
 * @this {Node}
 *
 * Measure effective Node content height via a temporary neutral probe appended to the Node.
 * The probe's normalized top (relative to Node padding issues) equals the content height because
 * it's placed after all flow content. The probe is removed immediately.
 *
 * Caveat: in grid/table cells the measured height can be misleading.
 * When the row is stretched by neighboring content, the probe lands at a
 * position dictated by the row layout, not by this cell’s own content flow.
 * That means `getNormalizedTop(probe, cell)` may return the stretched row
 * height minus padding, even if the cell’s actual content is much shorter.
 * Use this only when you need “what the layout engine made this box contain”;
 * if you need the cell’s intrinsic content height, measure padding/border
 * separately and cap the content measurement accordingly.
 */
export function getContentHeightByProbe(container, containerComputedStyle) {
  const containerStyle = containerComputedStyle ? containerComputedStyle : this._DOM.getComputedStyle(container);
  const probe = this.createNeutralBlock();
  this._DOM.setStyles(probe, {
    display: 'block',
    padding: '0',
    margin: '0',
    border: '0',
    height: '0',
    clear: 'both',
    visibility: 'hidden',
    contain: 'layout',
  });
  this._DOM.insertAtEnd(container, probe);
  const h = this.getNormalizedTop(probe, container, containerStyle);
  this._DOM.removeNode(probe);
  return h;
}

/**
 * @this {Node}
 *
 * 🤖 Generic bounds resolver: works for a single HTMLElement or an array of HTMLElements.
 * Set want = 'top' or 'bottom' to short-circuit when only one bound is needed.
 *
 * Inputs:
 *  - row: HTMLElement, or an array of HTMLElements (grid row as cells).
 *  - root: HTMLElement against which offsets are measured.
 *  - want: 'top' | 'bottom' | 'both' (default 'both').
 *
 * Returns:
 *  - { top: number, bottom: number } when measurement succeeds.
 *  - { top: undefined, bottom: undefined } and a strictAssert when no valid measurements are found or payload is unexpected.
 */
export function resolveRowBoundsGeneric(row, root, want = 'both') {
  const needTop = want !== 'bottom';
  const needBottom = want !== 'top';

  if (row instanceof HTMLElement) {
    const top = needTop ? this.getTop(row, root) : undefined;
    const bottom = needBottom ? this.getBottom(row, root) : undefined;

    if (needTop && !Number.isFinite(top)) {
      this.strictAssert(false, '[resolveRowBoundsGeneric] failed to measure top for HTMLElement', { row, root, want });
      return { top: undefined, bottom: undefined };
    }
    if (needBottom && !Number.isFinite(bottom)) {
      this.strictAssert(false, '[resolveRowBoundsGeneric] failed to measure bottom for HTMLElement', { row, root, want });
      return { top: undefined, bottom: undefined };
    }

    if (want === 'top') {
      return { top, bottom: top };
    }
    if (want === 'bottom') {
      return { top: bottom, bottom };
    }
    return { top, bottom };
  }

  if (Array.isArray(row)) {
    let minTop = needTop ? Infinity : undefined;
    let maxBottom = needBottom ? -Infinity : undefined;
    let foundTop = false;
    let foundBottom = false;
    row.forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;
      if (needTop) {
        const top = this.getTop(cell, root);
        if (Number.isFinite(top)) {
          minTop = Math.min(minTop, top);
          foundTop = true;
        }
      }
      if (needBottom) {
        const bottom = this.getBottom(cell, root);
        if (Number.isFinite(bottom)) {
          maxBottom = Math.max(maxBottom, bottom);
          foundBottom = true;
        }
      }
    });
    if (want === 'top') {
      if (!foundTop) {
        this.strictAssert(false, '[resolveRowBoundsGeneric] no valid top found in row array', { row, root, want });
        return { top: undefined, bottom: undefined };
      }
      return { top: minTop, bottom: minTop };
    }
    if (want === 'bottom') {
      if (!foundBottom) {
        this.strictAssert(false, '[resolveRowBoundsGeneric] no valid bottom found in row array', { row, root, want });
        return { top: undefined, bottom: undefined };
      }
      return { top: maxBottom, bottom: maxBottom };
    }
    if (needTop && !foundTop) {
      this.strictAssert(false, '[resolveRowBoundsGeneric] no valid top found in row array', { row, root, want });
      return { top: undefined, bottom: undefined };
    }
    if (needBottom && !foundBottom) {
      this.strictAssert(false, '[resolveRowBoundsGeneric] no valid bottom found in row array', { row, root, want });
      return { top: undefined, bottom: undefined };
    }
    return { top: minTop, bottom: maxBottom };
  }

  this.strictAssert(false, '[resolveRowBoundsGeneric] unexpected row payload', { row, root, want });
  return { top: undefined, bottom: undefined };
}
