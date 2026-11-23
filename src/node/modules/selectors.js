// ✅ selectors

import { debugFor } from '../utils/debugFor.js';
const _isDebug = debugFor('selectors');

/**
 * @this {Node}
 */
export function isSelectorMatching(element, selector) {
  if (!element || !selector) {
    _isDebug(this) && console.warn('isSelectorMatching() must have 2 params',
      '\n element: ', element,
      '\n selector: ', selector);
    return;
  }

  const selectors = [selector];
  if (typeof selector === 'string' && selector.includes('html2pdf4doc')) {
    const legacySelector = selector.replaceAll('html2pdf4doc', 'html2pdf');
    if (legacySelector !== selector) {
      selectors.push(legacySelector);
    }
  }

  return selectors.some((item) => {
    const first = item.charAt(0);

    if (first === '.') {
      const cl = item.substring(1);
      return this._DOM.hasClass(element, cl);

    } else if (first === '#') {
      const id = item.substring(1);
      return this._DOM.hasID(element, id);

    } else if (first === '[') {
      this.strictAssert(
        item.at(-1) === ']', `the ${item} selector is not OK.`
      );
      const attr = item.substring(1, item.length - 1);
      return this._DOM.hasAttribute(element, attr);

    } else {
      // Strictly speaking, the tag name is not a selector,
      // but to be on the safe side, let's check that too:
      return this._DOM.getElementTagName(element) === item.toUpperCase();
    }
  });
}

// CHECK NODE TYPE

/**
 * @this {Node}
 */
export function isSignificantTextNode(element) {
  if (this._DOM.isTextNode(element)) {
    return (this._DOM.getNodeValue(element).trim().length > 0) ? true : false;
  }
  return false;
}

/**
 * @this {Node}
 */
export function isSTYLE(element) {
  return this._DOM.getElementTagName(element) === 'STYLE'
}

/**
 * @this {Node}
 */
export function isIMG(element) {
  return this._DOM.getElementTagName(element) === 'IMG'
}

/**
 * @this {Node}
 */
export function isSVG(element) {
  return this._DOM.getElementTagName(element) === 'svg'
}

/**
 * @this {Node}
 */
export function isOBJECT(element) {
  return this._DOM.getElementTagName(element) === 'OBJECT'
}

/**
 * @this {Node}
 */
export function isLiNode(element) {
  return this._DOM.getElementTagName(element) === 'LI';
}

// CHECK SERVICE ELEMENTS

/**
 * @this {Node}
 */
export function isNeutral(element) {
  return this.isSelectorMatching(element, this._selector.neutral);
}

/**
 * @this {Node}
 */
export function isWrappedTextNode(element) {
  return this.isSelectorMatching(element, this._selector.textNode)
}

/**
 * @this {Node}
 */
export function isWrappedTextLine(element) {
  return this.isSelectorMatching(element, this._selector.textLine)
}

/**
 * @this {Node}
 */
export function isWrappedTextGroup(element) {
  return this.isSelectorMatching(element, this._selector.textGroup)
}

/**
 * @this {Node}
 */
/**
 * @this {Node}
 */
export function isContentFlowStart(element) {
  return this.isSelectorMatching(element, this._selector.contentFlowStart)
}

/**
 * @this {Node}
 */
export function isAfterContentFlowStart(element) {
  let elementBeforeInspected = this._DOM.getLeftNeighbor(element);
  while (
    elementBeforeInspected
    && (
      this.shouldSkipFlowElement(elementBeforeInspected, { context: 'isAfterContentFlowStart' })
      || isZeroHeightContent.call(this, elementBeforeInspected)
    )
  ) {
    elementBeforeInspected = this._DOM.getLeftNeighbor(elementBeforeInspected);
  }
  return this.isSelectorMatching(elementBeforeInspected, this._selector.contentFlowStart)
}

/**
 * An element without height, for example an empty anchor DIV,
 * does not start the content: a page break before the element
 * after it would leave an empty first page.
 * Service markers keep their meaning and are not skipped.
 *
 * @this {Node}
 */
function isZeroHeightContent(element) {
  if (this.isContentFlowStart(element) || this.isForcedPageBreak(element)) {
    return false;
  }
  return this._DOM.getElementOffsetHeight(element) === 0;
}

/**
 * @this {Node}
 */
export function isContentFlowEnd(element) {
  return this.isSelectorMatching(element, this._selector.contentFlowEnd)
}

/**
 * @this {Node}
 */
export function isComplexTextBlock(element) {
  return this.isSelectorMatching(element, this._selector.complexTextBlock)
}

/**
 * @this {Node}
 */
export function isSyntheticTextWrapper(element) {
  return this.isComplexTextBlock(element)
         || this.isWrappedTextNode(element)
         || this.isWrappedTextLine(element)
         || this.isWrappedTextGroup(element);
}

/**
 * @this {Node}
 */
/**
 * @this {Node}
 */
/**
 * @this {Node}
 */
/**
 * @this {Node}
 */
export function isForcedPageBreak(element) {
  // todo: use attribute instead of custom html element inserted in DOM.
  return this.isSelectorMatching(element, this._selector.printForcedPageBreak)
}

/**
 * @this {Node}
 */
export function isInline(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  const computedStyle = style || this._DOM.getComputedStyle(element);
  const display = computedStyle.display;
  const res = display === "inline"
    || display === "inline-block"
    || display === "inline-table"
    || display === "inline-flex"
    || display === "inline-grid";
  return res;
}

/**
 * @this {Node}
 */
export function isInlineBlock(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  const computedStyle = style || this._DOM.getComputedStyle(element);
  const display = computedStyle.display;
  const res = display === "inline-block"
    || display === "inline-table"
    || display === "inline-flex"
    || display === "inline-grid";
  return res;
}

/**
 * @this {Node}
 */
export function isGrid(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  const computedStyle = style || this._DOM.getComputedStyle(element);
  const display = computedStyle.display;
  const res = display === "grid";
  return res;
}

/**
 * @this {Node}
 */
export function isTableLikeNode(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  const computedStyle = style || this._DOM.getComputedStyle(element);
  const display = computedStyle.display;

  // 1) Table formatting root without the TABLE tag (e.g. div { display:table/inline-table })
  if (
    this._DOM.getElementTagName(element) !== 'TABLE'
    && ['table', 'inline-table'].includes(display)
  ) {
    return true;
  }

  // 2) Pseudo-table rows/groups outside of <table>: node itself is row-like.
  const isRowDisplay = (d) => d === 'table-row';
  const isRowGroupDisplay = (d) => (
    d === 'table-row-group'
    || d === 'table-header-group'
    || d === 'table-footer-group'
  );
  const isCellDisplay = (d) => d === 'table-cell';

  // table-row: consider table-like if it has at least one table-cell child.
  if (isRowDisplay(display)) {
    const children = this._DOM.getChildren(element);
    for (const cell of children) {
      if (!(cell instanceof HTMLElement)) continue;
      if (isCellDisplay(this._DOM.getComputedStyle(cell).display)) {
        return true;
      }
    }
    return false;
  }

  // table-row-group/header/footer: consider table-like if it contains a row with at least one cell.
  if (isRowGroupDisplay(display)) {
    const rows = this._DOM.getChildren(element);
    for (const maybeRow of rows) {
      if (!(maybeRow instanceof HTMLElement)) continue;
      const maybeRowDisplay = this._DOM.getComputedStyle(maybeRow).display;
      if (!isRowDisplay(maybeRowDisplay)) continue;
      const cells = this._DOM.getChildren(maybeRow);
      for (const cell of cells) {
        if (!(cell instanceof HTMLElement)) continue;
        if (isCellDisplay(this._DOM.getComputedStyle(cell).display)) {
          return true;
        }
      }
    }
    return false;
  }

  return false;
}

/**
 * @this {Node}
 */
export function isTableNode(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  //! const computedStyle = style || this._DOM.getComputedStyle(element);
  //*** STRICTDOC specific
  //*** add scroll for wide tables */
  //* issue#1370 https://css-tricks.com/preventing-a-grid-blowout/ */
  // so table can has 'block' and 'nowrap'.
  return this._DOM.getElementTagName(element) === 'TABLE'
    //!  || ['table', 'inline-table'].includes(computedStyle.display)
}

/**
 * @this {Node}
 */
export function isPRE(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  const computedStyle = style || this._DOM.getComputedStyle(element);
  // this._DOM.getElementTagName(element) === 'PRE'
  return [
    'block'
  ].includes(computedStyle.display)
    && [
      'pre',
      'pre-wrap',
      'pre-line',
      'break-spaces',
      'nowrap'
    ].includes(computedStyle.whiteSpace);
}

/**
 * @this {Node}
 */
export function isGridAutoFlowRow(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  const computedStyle = style || this._DOM.getComputedStyle(element);
  const display = computedStyle.display;
  const gridAutoFlow = computedStyle.gridAutoFlow;
  const res1 = (display === "grid") || (display === "inline-grid");
  const res2 = gridAutoFlow === "row";
  return res1 && res2;
}

/**
 * @this {Node}
 */
export function isFlexRow(element, style) {
  if (!(element instanceof HTMLElement)) {
    return
  }
  const computedStyle = style || this._DOM.getComputedStyle(element);
  const display = computedStyle.display;
  if (display !== 'flex' && display !== 'inline-flex') {
    return false;
  }
  const direction = computedStyle.flexDirection || '';
  return direction.startsWith('row');
}

/**
 * @this {Node}
 */
export function isNotBreakable(element, _style) {
  // TODO
  const _isInlineBlock = _style ? this.isInlineBlock(element, _style) : false;

  return this.isNoBreak(element)
    || this.isWrappedTextLine(element)
    || this.isWrappedTextGroup(element)
    || _isInlineBlock
    || this.notSolved(element);
}

// marks for isSlicedParent
// FIXME should be removed when we migrate to split (not slice)

/**
 * @this {Node}
 */
export function isSliced(element, style) {
  // used in Pages for isSlicedParent
  const computedStyle = style || this._DOM.getComputedStyle(element);
  return (
    this.isTableNode(element, computedStyle) ||
    this.isTableLikeNode(element, computedStyle) ||
    this.isGridAutoFlowRow(element, computedStyle) // todo
  );
}

/**
 * @this {Node}
 */
export function isSlough(element) {
  // todo
  // used in likeTable and Pages (for isSlicedParent)
  return this._DOM.hasAttribute(element, 'slough-node');
}
