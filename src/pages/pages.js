import arrayFromString from './arrayFromString.js';
import * as Logging from '../utils/logging.js';

const CONSOLE_CSS_COLOR_PAGES = '#66CC00';
const CONSOLE_CSS_PRIMARY_PAGES = `color: ${CONSOLE_CSS_COLOR_PAGES};font-weight:bold`;
const CONSOLE_CSS_LABEL_PAGES = `border:1px solid ${CONSOLE_CSS_COLOR_PAGES};`
                              + `background:#EEEEEE;`
                              + `color:${CONSOLE_CSS_COLOR_PAGES};`

const CONSOLE_CSS_END_LABEL = `background:#999;color:#FFF;padding: 0 4px;`;

export default class Pages {

  constructor({
    config,
    DOM,
    node,
    selector,
    layout,
    referenceWidth,
    referenceHeight
  }) {

    Object.assign(this, Logging);

    // * From config:
    this._debug = config.debugMode ? { ...config.debugConfig.pages } : {};
    this._assert = config.consoleAssert ? true : false;

    // * Private
    this._selector = selector;
    this._node = node;

    this._configSelectors = {
      noHanging: config.noHangingSelectors,
      pageBreakBefore: config.pageBreakBeforeSelectors,
      pageBreakAfter: config.pageBreakAfterSelectors,
      forcedPageBreak: config.forcedPageBreakSelectors,
      noBreak: config.noBreakSelectors,
      garbage: config.garbageSelectors,
    }

    // ***:
    this._DOM = DOM;

    this._root = layout.root;
    this._contentFlow = layout.contentFlow;

    this._referenceWidth = referenceWidth;
    this._referenceHeight = referenceHeight;

    // todo
    // 1) move to config
    // Paragraph:
    this._minLeftLines = 2;
    this._minDanglingLines = 2;
    this._minBreakableLines = this._minLeftLines + this._minDanglingLines;
    // Table:
    // # can be a single row with long content
    this._minLeftRows = 1; // ! min 1!
    this._minDanglingRows = 1;  // ! min 1!
    this._minBreakableRows = 1; // this._minLeftRows + this._minDanglingRows;
    // Code:
    this._minPreFirstBlockLines = 3;
    this._minPreLastBlockLines = 3;
    this._minPreBreakableLines = this._minPreFirstBlockLines + this._minPreLastBlockLines;
    // Grid:
    this._minBreakableGridRows = 4;

    this._imageReductionRatio = 0.8;

    // TODO make function
    // * From config:
    // - if null is set - the element is not created in createSignpost().
    this._signpostHeight = parseFloat(config.splitLabelHeight) || 0;

    // TODO: # _minimumBreakableHeight
    this._commonLineHeight = this._node.getLineHeight(this._root);
    this._minimumBreakableHeight = this._commonLineHeight * this._minBreakableLines;

    // * ***
    this._contentFlowEnd;
    this._contentFlowLastChild;
    // * Public

    this.pages = [];
  }

  calculate() {
    this._removeGarbageElements();
    this._prepareConfigSelectorConstraints();
    this._calculatePageStarts();
    this._resolvePageEnds();

    this._debug._ && console.log('%c ✔ Pages.calculate()', CONSOLE_CSS_LABEL_PAGES, this.pages);

    return this.pages;
  }

  _removeGarbageElements() {
    const _garbageSelectors = arrayFromString(this._configSelectors.garbage);
    if (_garbageSelectors.length) {
      const elements = this._node.resolveConfigSelectorConstraints(_garbageSelectors, this._contentFlow);
      elements.forEach(element => {
        this._DOM.removeNode(element)
      });
    }
  }

  _prepareConfigSelectorConstraints() {
    this._debug._ && console.groupCollapsed('🗂️ prepare config selector constraints');
    const _noHangingSelectors = arrayFromString(this._configSelectors.noHanging);
    const _pageBreakBeforeSelectors = arrayFromString(this._configSelectors.pageBreakBefore);
    const _pageBreakAfterSelectors = arrayFromString(this._configSelectors.pageBreakAfter);
    const _forcedPageBreakSelectors = arrayFromString(this._configSelectors.forcedPageBreak);
    const _noBreakSelectors = arrayFromString(this._configSelectors.noBreak);

    const _noHangingElements = this._prepareNoHangingElements(_noHangingSelectors);
    const _pageBreakElements = this._prepareForcedPageBreakElements({
      beforeSelectors: _pageBreakBeforeSelectors,
      afterSelectors: _pageBreakAfterSelectors,
      forcedSelectors: _forcedPageBreakSelectors
    });
    const _noBreakElements = this._prepareNoBreakElements(_noBreakSelectors);
    this._debug._ && console.groupEnd('🗂️ prepare config selector constraints');
  }

  _prepareNoHangingElements(selectors) {
    if (selectors.length) {
      const elements = this._node.resolveConfigSelectorConstraints(selectors, this._contentFlow, 'noHangings');
      elements.forEach(element => {
        this._node.markNoHanging(element);
        const lastChildParent = this._node.findLastChildParent(element, this._contentFlow)
        if (lastChildParent) {
          this._node.markNoHanging(lastChildParent, 'parent');
        }
      });
      this._debug._ && elements.length && console.log('✓ noHangings got the flag');
    }
  }

  _prepareNoBreakElements(selectors) {
    if (selectors.length) {
      const elements = this._node.resolveConfigSelectorConstraints(selectors, this._contentFlow, 'noBreaks');
      elements.forEach(element => this._node.markNoBreak(element));
      this._debug._ && elements.length && console.log('✓ noBreaks got the flag');
    }
  }

  _prepareForcedPageBreakElements({ beforeSelectors, afterSelectors, forcedSelectors }) {
    // ** Must be called after _prepareNoHangingElements()

    const pageStarters = beforeSelectors.length
                       ? this._node.resolveConfigSelectorConstraints(beforeSelectors, this._contentFlow, 'pageStarters')
                       : [];
    const pageEnders = afterSelectors.length
                     ? this._node.resolveConfigSelectorConstraints(afterSelectors, this._contentFlow, 'pageEnders')
                     : [];
    // there's at least one element:
    const forcedPageStarters = this._node.resolveConfigSelectorConstraints(forcedSelectors, this._contentFlow, 'forcedPageStarters');

    // ** If the element is the FIRST child of nested FIRST children of a content flow,
    // ** we do not process it further for page breaks.
    // ** This ensures that page breaks are only made where they have not already been made for other reasons.
    // *** And consider that the first element is actually a service element ContentFlowStart.
    if (pageStarters.length) {
      const inspectedElement = pageStarters[0];
      const inspectedElementMaxFChParent = this._node.findFirstChildParent(inspectedElement,this._contentFlow) || inspectedElement;
      const isInspectedElementStartsContent = this._node.isAfterContentFlowStart(inspectedElementMaxFChParent);
      if (isInspectedElementStartsContent) {
        pageStarters.shift();
      };
    }
    // ** If the element is the LAST child of nested LAST children of a content flow,
    // ** we do not process it further for page breaks.
    // ** This ensures that page breaks are only made where they have not already been made for other reasons.
    // *** And consider that the last element is actually a service element ContentFlowEnd.
    if (pageEnders.length) {
      const inspectedElement = pageEnders.at(-1);
      const inspectedElementMaxLastChParent = this._node.findLastChildParent(inspectedElement,this._contentFlow) || inspectedElement;
      const elementAfterInspected = this._DOM.getRightNeighbor(inspectedElementMaxLastChParent);
      const isInspectedElementEndsContent = this._node.isContentFlowEnd(elementAfterInspected);
      if (isInspectedElementEndsContent) {
        pageEnders.pop()
      };
    }

    // * find all relevant elements and insert forced page break markers before them.
    pageStarters.length && pageStarters.forEach(element => {
      const candidate = this._node.findBetterForcedPageStarter(element, this._contentFlow);
      this.strictAssert(candidate, 'findBetterForcedPageStarter should return an element. Returns:', candidate);
      this._DOM.insertBefore(candidate, this._node.createForcedPageBreak());
      this._debug._ && console.log('📄⤵️ pageStarters • inserted before', {candidate, element});
    });

    // * find all relevant elements and insert forced page break markers before them.
    forcedPageStarters && forcedPageStarters.forEach(element => {
      // ** If it is not a forced page break element inserted by hand into the code:
      if(!this._node.isForcedPageBreak(element)) {
        const candidate = this._node.findBetterForcedPageStarter(element, this._contentFlow);
        this.strictAssert(candidate, 'findBetterForcedPageStarter should return an element. Returns:', candidate);
        this._DOM.insertBefore(candidate, this._node.createForcedPageBreak());
        this._debug._ && console.log('📄⤵️⤵️ forcedPageStarters • inserted before', {candidate, element});
      }
      // ** In other case we leave it as it is.
    });

    // * find all relevant elements and insert forced page break markers after them.
    pageEnders.length && pageEnders.forEach(element => {
      const lastChildParent = this._node.findLastChildParent(element, this._contentFlow)
      if (lastChildParent) {
        element = lastChildParent;
      }
      // If there are AFTER and BEFORE breaks - insert only one.
      if (!this._node.isForcedPageBreak(this._DOM.getRightNeighbor(element))) {
        this._DOM.insertAfter(element, this._node.createForcedPageBreak());
        this._debug._ && console.log('📄⤴️ pageEnders • inserted after', {element});
      } // else pass
    });
  }

  _registerFirstPage() {
    this._registerPageStart({
      element: this._DOM.getElement(this._selector.contentFlowStart, this._contentFlow),
      context: 'register First Page',
    });
  }

  _isContentFlowShort() {
    const contentFlowEnd = this._DOM.getElement(this._selector.contentFlowEnd, this._contentFlow);
    const contentFlowBottom = this._node.getBottom(contentFlowEnd, this._root);
    const result = contentFlowBottom < this._referenceHeight;
    this._debug._ && result && console.log(`contentFlow (${contentFlowBottom}) fits on the page (${this._referenceHeight})`);
    return result;
  }

  _resolveForcedPBInsideContentFlow() {
    this._node.findAllForcedPageBreakInside(this._contentFlow).forEach(
      element => this._registerPageStart({ element, context: 'All Forced Page Break Inside _contentFlow' })
    );
  }

  _calculatePageStarts() {

    // ✳️ register a FIRST page
    this._registerFirstPage();

    // ✴️ if contentFlow is less than one page
    if (this._isContentFlowShort()) {
      // In the case of a single page, we don't examine the contentFlow children.
      // Check for forced page breaks, and if they are, we register these pages.
      // If not - we'll have a single page.
      this._resolveForcedPBInsideContentFlow();
      return;
    }

    // ✳️ continue to analyze contentFlow children

    const content = this._node.getPreparedChildren(this._contentFlow);
    // * Register last visible (!) content flow child to reset bottom margins.
    // * Very last is <html2pdf4doc-content-flow-end>, so we get the one before them : at(-2).
    this._contentFlowEnd = content.at(-1);
    this._contentFlowLastChild = content.at(-2);

    this._debug._ && console.groupCollapsed('%c🚸 children(contentFlow)', CONSOLE_CSS_LABEL_PAGES);
    this._debug._ && console.log(content);
    this._debug._ && console.groupEnd('%c🚸 children(contentFlow)', CONSOLE_CSS_LABEL_PAGES);

    this._parseNodes({
      array: content
    });
  }

  _resolvePageEnds() {
    for (let i = 1; i < this.pages.length; i += 1) {
      const prev = this.pages[i - 1];
      const curr = this.pages[i];
      prev.pageEnd = curr.prevPageEnd;
      // * For the last page, there is no previously marked pageEnd.
    }
    // * For the last page:
    this.pages[this.pages.length - 1].toResetBottom = this._contentFlowLastChild;
    this.pages[this.pages.length - 1].pageEnd = this._contentFlowEnd;
  }

  _registerPageStart({
      element,
      improveResult = false,
      type = 'current',
      context = ''
    }) {
    this._debug._registerPageStart && console.log(
      `%c📍`, "background:yellow;font-weight:bold",
      '\n  improveResult:', improveResult,
      '\n  passed pageStart:', element,
      '\n  context:', context,
    );

    // ✴️ skip for content flow end
    if (type === 'next' && this._node.isContentFlowEnd(element)) {
      this._debug._parseNode && console.log(
        `🏁 [registerAsPageStart] reaches the ContentFlowEnd element}. SKIP registering.`,
        element);
      return
    }

    // ✴️ skip for already registered page
    if (this._node.isPageStart(element)) {
      this._debug._registerPageStart && console.warn(
        '🚨 [_registerPageStart] pageStart candidate is already PageStartElement, return',
        element);
      return
    };

    if (this._node.isIgnorableSpacerParagraph(element)) {
      this._debug._registerPageStart && console.log(`🚩 [registerAsPageStart] pageStart candidate is an ignorable spacer paragraph. SKIP registering.`, element);
      // TODO: defer mutation to the end of the algorithm, and do it in batch, to avoid multiple forced reflows.
      this._DOM.setStyles(element, {'display': ['none', 'important']});
      this._DOM.addClasses(element, '🕶️');
      return
    }

    let pageStart = element;

    if (improveResult) {
      this._debug._registerPageStart && console.log('[_registerPageStart] improve result:')
      pageStart = this._node.findBetterPageStart(
        pageStart,
        this.pages.at(-1)?.pageStart,
        this._root
      )
    }

    if (!this._DOM.getElementOffsetParent(pageStart)) {
      this._debug._registerPageStart && console.warn(
        '🚨 pageStart has no offsetParent. Check the caller.',
        pageStart,
      );
    }

    const pageStartTopInfo = this._node.getPageStartTopInfo(pageStart, this._root);
    const pageTop = pageStartTopInfo?.top;
    const pageBottom = pageTop + this._referenceHeight;
    const prevPageEnd = this._DOM.getLeftNeighbor(pageStart);
    this.pages.push({
      pageStart: pageStart,
      pageBottom: pageBottom,
      pageTop: pageTop,
      pageTopAnchor: pageStartTopInfo?.anchor || null,
      prevPageEnd: prevPageEnd,
    });
    this._node.markPageStart(pageStart, this.pages.length);
    this._debug._registerPageStart && console.log(
      `%c📍register page ${this.pages.length}`, "background:yellow;font-weight:bold",
      '\n  improved result:', improveResult,
      '\n  pageTop:', pageTop,
      '\n  pageBottom:', pageBottom,
      '\n  pageStart:', pageStart,
      '\n  pageTopAnchor:', pageStartTopInfo?.anchor || null,
    );
  }

  _parseNodes({
    previous,
    next,
    array,
    arrayTopParent,
    arrayBottomParent,
  }) {
    this._debug._parseNodes && console.log('🔵 _parseNodes', {array, arrayTopParent, arrayBottomParent});

    for (let i = 0; i < array.length; i++) {
      const currentElement = array[i];
      const isFirstChild = i === 0;
      const isLastChild = i === array.length - 1;

      // * First and last children inherit the parent as the page anchor when possible
      // *** Here we throw from above or reset for non-edge ones.
      const _topParent = isFirstChild ? arrayTopParent : undefined;
      const _bottomParent = (isLastChild && arrayBottomParent) ? arrayBottomParent : undefined;

      this._parseNode({
        previousElement: array[i - 1] || previous,
        currentElement,
        nextElement: array[i + 1] || next,
        isFirstChild,
        isLastChild,
        arrayTopParent: _topParent, // provided only for boundary children where the wrapper matters
        arrayBottomParent: _bottomParent, // provided only for boundary children where the wrapper matters
      });
    }
  }

  // 📍
  _parseNode({
    isFirstChild,
    isLastChild,
    previousElement,
    currentElement,
    nextElement,
    arrayTopParent,
    arrayBottomParent,
  }) {
    const consoleMark = ['%c[_parseNode]\n', 'color:white;',]

    this._debug._parseNode && console.groupCollapsed(
      `%c_parseNode`, CONSOLE_CSS_PRIMARY_PAGES,
      `${isFirstChild && isLastChild ? '★ [first+last]' : isFirstChild ? '★ [first]' : isLastChild ? '★ [last]' : '<- regular ->'}`,
      '📄', this.pages.length,
        { currentElement },
      );

    this._debug._parseNode && console.log(
      {
        previousElement,
        currentElement,
        nextElement,
        isFirstChild,
        isLastChild,
        arrayTopParent,
        arrayBottomParent,
      }
      );

    // ✴️ THE END of content flow:
    // if there is no next element, then we are in a case where the 'html2pdf4doc-content-flow-end' element is current.
    if (!nextElement) {
      this._node.markProcessed(currentElement, 'content-flow-end');
      this._debug._parseNode && console.log('%c END _parseNode (!nextElement)', CONSOLE_CSS_END_LABEL);
      this._debug._parseNode && console.groupEnd()
      return
    }

    const currentElementBottom = this._node.getBottom(currentElement, this._root);
    const arrayParentBottomEdge = arrayBottomParent ? this._node.getBottom(arrayBottomParent, this._root) : undefined;

    // * We want to keep the passed 'arrayParentBottomEdge' value so that we can pass it
    // * on to the next step in the loop if necessary, even if we have to change
    // * this in the current step to handle edge cases.
    // * nullish coalescing keeps legitimate 0 offsets, yet still falls back
    // * to the element itself when the parent is missing or stale.
    let currentParentBottomEdge = arrayParentBottomEdge;

    // * If there is a arrayParentBottomEdge - we are dealing with the last child of the last child
    // * (have after the current element the lower edges of one or more of its parents).
    // * Consider the case of extreme design:
    // * if the custom design shifts arrayParentBottomEdge down a lot because of padding or margins or similar.
    // * Then let's check where the bottom edge of the current element is.
    // * If currentElementBottom is lower than “start of new page” (currentElementBottom > this.pages.at(-1).pageBottom) -
    // * this case is handled further, with an attempt to split the current element.
    // * But if it is higher (currentElementBottom <= this.pages.at(-1).pageBottom) - we won't try to split it lower in the algorithm.
    // * And the space is occupied by something between the current element and the lower bounds of its parents.
    // * And this “something” we don't know - we only know the lower bounds of some nested elements.
    // ** Let's try to insert a page break between the bottom borders of the parents.
    // ** Also check - if the distance between the bottom border of the current and its parent is
    // ** 1) greater than 1 page,
    // ** 2) has no break point (something solid)
    // ** - we'll describe it as an unsolved issue for now.

    const currentElementTop = this._node.getTop(currentElement, this._root);

    // Tail exists only if the space between the current element’s bottom and its parent’s bottom
    // exceeds a full page (i.e., the tail of wrappers below the current element is longer than a page).
    // Using `top` here misclassifies long elements as a tail; rely on `currentElementBottom` instead.
    const _isTailLongerThanPage = arrayParentBottomEdge !== undefined && ((arrayParentBottomEdge - currentElementBottom) >= this._referenceHeight);
    if (_isTailLongerThanPage) {
      // ** if arrayParentBottomEdge ---> current is LAST
      // ** if arrayParentBottomEdge > (currentElementTop + this._referenceHeight) ---> we have a “tail” of the lower bounds of the parent tags,
      // * and there are obviously set margins or paddings that take up space.
      // * And now the only case where we can insert a page break between these boundaries
      // * (register a break after an element without having the next one).
      // * To do this, we will have to insert a service element after the desired parent element
      // * and assign the service element as the “start of the page”.

      currentParentBottomEdge = undefined;

      this._debug._parseNode && console.log(
        '🪁 Tail: We got a tail from the lower shells of the last child. Giving up our “last child” rule here and will try to insert a page break at the end of some parent. ',
        {arrayParentBottomEdge, currentParentBottomEdge,  currentElementBottom, pageBottom: this.pages.at(-1).pageBottom,},
        {currentElement, arrayBottomParent},
      );

      if (currentElementBottom <= this.pages.at(-1).pageBottom) {
        this._debug._parseNode && console.log('🪁 Tail: currentElementBottom <= this.pages.at(-1).pageBottom', );



        // * try to insert a page break between the bottom borders of the parents.

        const _parents = [];
        let _el = currentElement;

        this._debug._parseNode && console.log('🪁 Tail: currentElement', currentElement);

        while (_el && _el !== arrayBottomParent) {
          _parents.push({
            element: _el,
            bottom: this._node.getBottom(_el, this._root)
          });
          _el = _el.parentElement;
        }

        if (_el === arrayBottomParent) {
          _parents.push({
            element: arrayBottomParent,
            bottom: arrayParentBottomEdge,
          });
        } else {
          throw new Error('"bottom" parent not found in the ancestor chain');
        }

        this._debug._parseNode && console.log('🪁 Tail: _parents', _parents);

        // We start checking the current page. But if this “tail” is longer than the page,
        // we may need to break it more than once.

        this._debug._parseNode && console.log('🪁 Tail: current PageBottom', this.pages.at(-1).pageBottom);

        for (let i = 0; i < _parents.length; i++) {
            this._debug._parseNode && console.log('🪁 Tail: _parents[i].bottom', _parents[i].bottom, _parents[i].element);

          // We go down, that is, we assume that the previous element has been validated and fits in the page.
          // The very first one is the current one, and it fits.
          // If the i-th parent doesn't fit - we insert a page break after its last child (as its last child).
          if (_parents[i].bottom > this.pages.at(-1).pageBottom) {
            this._debug._parseNode && console.log('🪁 Tail: _parents[i].bottom > this.pages.at(-1).pageBottom', _parents[i].bottom, '>', this.pages.at(-1).pageBottom, _parents[i].element);

            const _newPageStarter = this._node.createNeutral();
            _newPageStarter.classList.add('service');
            this._DOM.insertAtEnd(_parents[i].element, _newPageStarter);
            this._registerPageStart({
              element: _newPageStarter,
              context: '_isTailLongerThanPage'
            }); // do not do PageStart improvement
            this._debug._parseNode && console.log('_registerPageStart', _newPageStarter);
            this._node.markProcessed(_newPageStarter, 'node is ForcedPageBreak');

            // * pageBottom has just been updated!

            // check if here is more then 1 split
            // this._node.getTopForPageStartCandidate(pageStart, this._root) + this._referenceHeight

            this._debug._parseNode && console.log(this.pages.at(-1).pageBottom, arrayParentBottomEdge);

            if (arrayParentBottomEdge > this.pages.at(-1).pageBottom) {
              this._debug._ && console.log('🧧 • arrayParentBottomEdge > this.pages.at(-1).pageBottom');
              // and go to next index
            } else {
              // stop iterating
              this._debug._parseNode && console.log('%c END _parseNode (bottom Tail of parents)', CONSOLE_CSS_END_LABEL);
              this._debug._parseNode && console.groupEnd();
              return
            }

          }
        }

        this._debug._parseNode && console.log('%c END _parseNode (bottom Tail of parents)', CONSOLE_CSS_END_LABEL);
        this._debug._parseNode && console.groupEnd();
        return

      } else {
        // At this point the parent chain forms a tail, but the current element itself still
        // stretches below the page cut. We cannot resolve the tail until the element fits, so
        // control falls through to the generic overflow logic below.
        this._debug._parseNode && console.log('🪁 Tail: currentElementBottom > this.pages.at(-1).pageBottom', 'DOING NOTHING' );
      }
    }

    // * Case after the next element has been registered
    // * and we are looking at it again
    // * (e.g. it is the height of the entire next page and falls under inspection).

    //! currentParentBottomEdge is refreshed right before, so descendants see live parent boundaries.
    const currentBlockBottom = currentParentBottomEdge ?? currentElementBottom;

    this._debug._parseNode && console.log('[_parseNode]', {currentBlockBottom, currentParentBottomEdge, currentElementBottom});
    if (
      // * already registered:
      this.pages.at(-1).pageStart === currentElement
      &&
      // * fits in the next page:
      (
        this._node.isNotBreakable(currentElement)
        || currentBlockBottom <= this.pages.at(-1).pageBottom
      )
    ) {
      this._node.markProcessed(currentElement, 'node is already registered and fits in the page');
      this._debug._parseNode && console.log('%c END _parseNode (node is already registered and fits in the next page)', CONSOLE_CSS_END_LABEL);
      this._debug._parseNode && console.groupEnd();
      return
    }

    // * Edge case, where we jumped through the check of the Previous or Parent (for example, in the tail case,
    // * going upward in search of a better page start), and the Current is already below the page limit.
    // * We need to check to make sure the Current one isn't compromised - or we should go back an element.
    // ** The >= condition works for any elements except ones that have no height (and should not produce new pages).
    // ** So let's add a height condition: (currentElementBottom - currentElementTop)

    if ((currentElementTop >= this.pages.at(-1).pageBottom) && (currentElementBottom - currentElementTop)) {
      const canUseParentTop = isFirstChild && Boolean(arrayTopParent);
      const parentTop = canUseParentTop ? this._node.getTopForPageStartCandidate(arrayTopParent, this._root) : undefined;
      const beginningTail = Boolean(parentTop) && (currentElementTop - parentTop >= this._referenceHeight);

      if (beginningTail) {
        // The top parent wrapper already spans more than a page above the current element.
        // Keep the element as the page-start anchor without climbing to the arrayTopParent: the
        // tail will be handled by downstream logic once the element fits on the new page.
        this._debug._parseNode && console.log(
          '🪁 beginning Tail',
          {parentTop, currentParentBottomEdge, currentElementTop, pageBottom: this.pages.at(-1).pageBottom,},
          {currentElement, arrayTopParent},
        );
      } else {
        // * No beginningTail:
        // most often the element is simply overflowed or wrapped in a thin
        // inline/contents container. Try to register the element (with semantic improvement)
        // so that findBetterPageStart can climb to a stable wrapper if needed.

        // * Thin wrappers (e.g. inline or contents containers)
        // contribute almost no intrinsic height: their children carry the layout box.
        // Once such a wrapper crosses the page boundary, repeating the tail logic on it
        // only triggers the “improve page start” flow again and produces duplicate breaks
        // (StrictDoc "Image in autogen >.document@ case).
        // Block wrappers, on the other hand, still need the tail loop.
        // To differentiate, look at the computed display; inline/contents are treated
        // as thin wrappers, block-level displays continue with the original flow.
        const currentDisplay = this._DOM.getComputedStyle(currentElement)?.display || '';
        const isInlineWrapper = currentDisplay.includes('inline');
        const isContentsWrapper = currentDisplay === 'contents';
        if (isInlineWrapper || isContentsWrapper) {
          this._debug._parseNode && console.log('🧅 current in thin wrapper');
          this._registerPageStart({
            element: currentElement,
            improveResult: true,
            context: '🧅 current in thin wrapper'
          });
          this._debug._parseNode && console.log('%c END _parseNode (registered new page start)', CONSOLE_CSS_END_LABEL);
          this._debug._parseNode && console.groupEnd();
          return
        }
      }

      this._registerPageStart({
        element: currentElement,
        improveResult: !beginningTail,
        context: 'currentElementTop >= this.pages.at(-1).pageBottom'
      });
    }

    // FORCED BREAK
    if (this._node.isForcedPageBreak(currentElement)) {
      // TODO I've replaced the 'next' with the 'current' - need to test it out
      this._registerPageStart({ element: currentElement, context: 'currentElement is ForcedPageBreak' });
      this._node.markProcessed(currentElement, 'node is ForcedPageBreak');
      this._debug._parseNode && console.log('%c END _parseNode (isForcedPageBreak)', CONSOLE_CSS_END_LABEL);
      this._debug._parseNode && console.groupEnd();
      return
    }

    this.strictAssert( // is filtered in the function _gerChildren()
      this._DOM.getElementOffsetParent(currentElement),
      'it is expected that the element has an offset parent',
      currentElement);

    const nextElementTop = this._node.getTop(nextElement, this._root);
    this._debug._parseNode && console.log(...consoleMark,
      '• pageBottom', this.pages.at(-1).pageBottom,
      '\n',
      '• nextElementTop',nextElementTop,
      );

    // TODO if next elem is SVG it has no offset Top!

    if (nextElementTop <= this.pages.at(-1).pageBottom) {
      this._debug._parseNode && console.log(
        'nextElementTop <= this.pages.at(-1).pageBottom', nextElementTop, '<=', this.pages.at(-1).pageBottom
      )
      // * IF: nextElementTop <= this.pages.at(-1).pageBottom,
      // * then currentElement fits.

      this._node.markProcessed(currentElement, 'node fits');

      // ** Check for page break markers inside.
      // ** If there are - register new page starts.
      this._node.findAllForcedPageBreakInside(currentElement).forEach(
        element => {
          this._node.markProcessed(element, 'node is ForcedPageBreak (inside a node that fits)');
          this._registerPageStart({ element, context: 'All Forced Page Break Inside currentElement' });
        }
      );
      // TODO: это может быть внутри таблицы или другого элемента,
      // который мы не хотим / не можем разбить обычным образом!
      // Нужно проверять currentElement

      // * ... then continue.

      this._debug._parseNode && console.log('%c END _parseNode (node pass)', CONSOLE_CSS_END_LABEL);
      this._debug._parseNode && console.groupEnd();
      return

    } else {
      this._debug._parseNode && console.log(
        'nextElementTop > this.pages.at(-1).pageBottom', nextElementTop, '>', this.pages.at(-1).pageBottom
      )
      // * ELSE IF: nextElementTop > this.pages.at(-1).pageBottom,
      // * nextElement does not start on the current page.
      // * Possible cases for the currentElement:
      // *** (1) is fit in one piece on the current page
      // *** (0) in one piece should be moved to the next page
      // *** (2) must be split

      // IF currentElement does fit
      // in the remaining space on the page,
      if (currentBlockBottom <= this.pages.at(-1).pageBottom) {
        this._debug._parseNode && console.log(
          'currentBlockBottom <= this.pages.at(-1).pageBottom', currentBlockBottom, '<=', this.pages.at(-1).pageBottom,
          '\n register nextElement as pageStart'
        );
        // we need <= because split elements often get equal height // todo comment

        // ? The currentElement has a chance to be the last one on the page.
        if (this._node.isNoHanging(currentElement)) {
          this._debug._parseNode && console.log(
            'currentElement fits / last, and _isNoHanging => move it to the next page'
          )
          // ** if currentElement can't be the last element on the page,
          // ** immediately move it to the next page:
          this._node.markProcessed(currentElement, 'it fits & last & _isNoHanging => move it to the next page');
          this._registerPageStart({
            element: currentElement,
            improveResult: true,
            context: 'currentElement is NoHanging'
          });

          this._debug._parseNode && console.log('%c END _parseNode (isNoHanging)', CONSOLE_CSS_END_LABEL);
          this._debug._parseNode && console.groupEnd();
          return
        }

        // * AND it's being fulfilled:
        // *** nextElementTop > this.pages.at(-1).pageBottom
        // * so this element cannot be the first child,
        // * because the previous element surely ends before this one begins,
        // * and so is its previous neighbor, not its parent.
        this._registerPageStart({
          element: nextElement,
          type: 'next',
          context: 'currentBlockBottom <= PgBtt && nextElementTop > PgBtt'
        });
        this._node.markProcessed(currentElement, `fits, its bottom falls exactly on the cut`);
        this._node.markProcessed(nextElement, `starts new page, its top is exactly on the cut`);
        this._debug._parseNode && console.log('%c END _parseNode (currentElement fits, register the next element)', CONSOLE_CSS_END_LABEL);
        this._debug._parseNode && console.groupEnd();
        return
      }

      // * Check the possibility of (0)

      // TODO перемещаем ниже отсюда кейс "Проверка на isNoHanging(currentElement)"" - это нужно тестировать!

      // * Check the possibility of (1) or (0): on current or next page in one piece?

      // IMAGE with optional resizing
      // TODO float images

      const mediaElement = this._node.resolveReplacedElement(currentElement, { prefer: 'first' });

      if (mediaElement) {
        // * CASE: a node is (or wraps) a single replaced element (IMG/SVG/OBJECT/…).
        // *** Trigger: currentElement cannot be split further, resolveReplacedElement unwraps it
        // *.  to one media box.
        // *** Goal: treat the media as an atomic block that we may keep, scale to remaining space,
        // *.  or move to next page.
        // *** Difference from the common branch: no child splitting; instead we measure
        // *   the actual bitmap/SVG box and compensate for inline baseline gap so the page cut
        // *   happens exactly at the visual bottom of the media.

        // TODO needs testing

        // svg has not offset props
        const isSvgMedia = this._node.isSVG(mediaElement);
        const currentImage = isSvgMedia
        // TODO replace with setMark... and remove wrapper function
        // TODO process at the beginning, find all SVG and set Flag
          ? this._node.createSignpost(mediaElement)
          : mediaElement;

        const currentImageTop = this._node.getTop(currentImage, this._root);
        const currentImageBottom = this._node.getBottom(currentImage, this._root);
        const parentTopForImage = (isFirstChild && arrayTopParent)
          ? this._node.getTop(arrayTopParent, this._root)
          : undefined;

        // * CASE: inline media near the page cut.
        // * Paragraph wrappers (even block-level ones) still lay out inline descendants in a line box.
        // * The line descender + half-leading pushes the wrapper’s visual bottom a few px below the image.
        // * When we don’t subtract that baseline gap, we overestimate the space left on the page and
        // * let the next block start before the page actually ends. We therefore sample the inline
        // * formatting parent (prefer arrayTopParent for first children, otherwise fall back to the DOM parent),
        // * ask it for the gap estimate, and shrink the available space accordingly.
        // * display:contents parents still provide inherited line-height/fonts via getComputedStyle,
        // * so the estimate stays valid even when they don’t create boxes.
        const _imageParent = arrayTopParent || this._DOM.getParentNode(currentImage);
        const imgGapBelow = this._node.estimateInlineImgGapBelow(_imageParent);

        // include the wrapper's top margin only for the first child; otherwise
        // measure from the current image top.
        let availableImageNodeSpace = this.pages.at(-1).pageBottom - currentImageTop - imgGapBelow;
        // if arrayParentBottomEdge: the node is last,
        // so let's subtract the probable margins at the bottom of the node,
        // which take away the available space for image-node placement:
        availableImageNodeSpace -= (
           arrayParentBottomEdge
            ? (arrayParentBottomEdge - currentImageBottom)
            : 0
        );


        // ? This variable is used in the “full page” case below, not here.
        // if parent: the node is first,
        // // so let's include the parent's top margins:
        // let fullPageImageNodeSpace = this._referenceHeight - imgGapBelow - (
        //    parentTopForImage !== undefined
        //     ? (currentImageTop - parentTopForImage)
        //     : 0
        // );
        // TODO: replace this._referenceWidth  with an padding/margin-dependent value


        const currentImageHeight = this._DOM.getElementOffsetHeight(currentImage);
        const currentImageWidth = this._DOM.getElementOffsetWidth(currentImage);

        this._debug._parseNode && console.log(
          '🖼️🖼️🖼️🖼️🖼️🖼️ (if mediaElement)', mediaElement,
          {
            _imageParent,
            arrayTopParent,
            arrayParentBottomEdge,
            availableImageNodeSpace,
            currentParentBottomEdge,
            currentElement,
            currentImage,
            currentImageHeight,
            currentImageWidth,
            isSvgMedia,
            imgGapBelow,
            parentTopForImage,
          }
        );

        // TODO !!! page width overflow for SVG
        if (currentImageWidth > this._referenceWidth) {
          // just leave it on the current page
          this._debug._parseNode && console.warn('%c IMAGE is too wide', 'color: red');
        }

        // if it fits
        if (currentImageHeight < availableImageNodeSpace) {
          // just leave it on the current page
          this._node.markProcessed(currentElement, 'IMG that fits, and next starts on next');
          this._registerPageStart({
            element: nextElement,
            type: 'next',
            context: 'currentImageHeight < availableImageNodeSpace'
          });
          this._debug._parseNode && console.log('Register next elements; 🖼️🖼️🖼️ IMG fits:', currentElement);
          this._debug._parseNode && console.log('%c END _parseNode 🖼️ IMG fits', CONSOLE_CSS_END_LABEL);
          this._debug._parseNode && console.groupEnd();
          return
        }

        // if not, try to fit it
        const ratio = availableImageNodeSpace / currentImageHeight;

        if (ratio > this._imageReductionRatio) {
          this._debug._parseNode && console.log('Register next elements; 🖼️🖼️🖼️ IMG RESIZE to availableImageNodeSpace:', availableImageNodeSpace, currentElement);
          this._node.markProcessed(currentElement, `IMG with ratio ${ratio}, and next starts on next`);
          // reduce it a bit
          this._node.fitElementWithinBoundaries({
            element: mediaElement,
            height: currentImageHeight,
            width: currentImageWidth,
            vspace: availableImageNodeSpace,
            hspace: this._referenceWidth
          });
          // and leave it on the current page
          this._registerPageStart({
            element: nextElement,
            type: 'next',
            context: 'current IMG was RESIZED to availableImageNodeSpace'
          });
          this._debug._parseNode && console.log('%c END _parseNode 🖼️ IMG scaled', CONSOLE_CSS_END_LABEL);
          this._debug._parseNode && console.groupEnd();
          return
        }

        // otherwise move it to next page,
        // *** 'true':
        // *** add the possibility of moving it with the wrap tag
        // *** if it's the first child
        this._node.markProcessed(currentElement, `IMG starts on next`);
        const pageStartElement = isSvgMedia ? currentImage : mediaElement;
        this._registerPageStart({
          element: pageStartElement,
          improveResult: true,
          context: 'move IMG it to next page'
        });
        this._debug._parseNode && console.log('🖼️ register Page Start', currentElement);

        // ** Recompute available space after improving page start:
        // ** the page anchor might sit above the image,
        // ** so the image must fit within the remaining page height.
        // * `this.pages.at(-1).pageBottom - currentImageTop` is not equal to this._referenceHeight
        // * because it is likely that a semantic improvement was made when the new page was registered,
        // * and the page starts somewhere above the image itself.
        let fullPageImageNodeSpace = this.pages.at(-1).pageBottom - currentImageTop - imgGapBelow;
        // * Rebuild the lower boundary for wrappers where the image stays the last child.
        // * arrayParentBottomEdge only exists when the current element is the last child in the loop.
        const tailParent = arrayParentBottomEdge
          ? null
          : this._node.findLastChildParent(currentElement, this._contentFlow);
        const tailBottomEdge = arrayParentBottomEdge
          ? arrayParentBottomEdge
          : this._node.getBottom((tailParent || currentElement), this._root);
        if (tailBottomEdge > currentImageBottom) {
          fullPageImageNodeSpace -= (tailBottomEdge - currentImageBottom);
        }

        // and avoid page overflow if the picture is too big to fit on the page as a whole
        if (currentImageHeight > fullPageImageNodeSpace) {
          this._node.fitElementWithinBoundaries({
            element: mediaElement,
            height: currentImageHeight,
            width: currentImageWidth,
            vspace: fullPageImageNodeSpace,
            hspace: this._referenceWidth
          });
          this._node.markProcessed(currentElement, `IMG starts on next and resized`);
          this._debug._parseNode && console.log('🖼️ ..and fit it to full page', currentElement);
        }
        this._debug._parseNode && console.log('%c END', CONSOLE_CSS_END_LABEL);
        this._debug._parseNode && console.groupEnd();
        return
      }

      // ... in case nextElementTop > this.pages.at(-1).pageBottom
      if(currentElement.style.height) {
        // TODO: create test
        this._debug._parseNode && console.log(
          '🥁 currentElement has HEIGHT', currentElement.style.height
        );
        // * If a node has its height set with styles, we handle it as a non-breaking object,
        // * and can just scale it if it doesn't fit on the page.

        const availableSpace = this.pages.at(-1).pageBottom - currentElementTop;
        const currentElementContextualHeight = nextElementTop - currentElementTop;

        const availableSpaceFactor = availableSpace / currentElementContextualHeight;
        const fullPageFactor = this._referenceHeight / currentElementContextualHeight;

        this._debug._parseNode && console.log(
          '\n🥁 currentElementTop', currentElementTop,
          '\n🥁 pageBottom', this.pages.at(-1).pageBottom,
          '\n🥁 availableSpace', availableSpace,
          '\n🥁 currentElementContextualHeight', currentElementContextualHeight,
          '\n🥁 availableSpaceFactor', availableSpaceFactor,
          '\n🥁 fullPageFactor', fullPageFactor,
        );

        this.strictAssert(availableSpaceFactor < 1);

        const applyScaleWithWrapper = (scale) => {
          this._DOM.setStyles(currentElement, {
            'transform': `scale(${scale})`,
            'transform-origin': `top center`,
          });
          // transform affects only visuals; wrap to make layout height reflect the scaled size.
          // Mirrors fitElementWithinHeight in fitters.js so we can reuse/commonize later. TODO: extract.
          const scaledHeight = Math.max(0, Math.trunc(currentElementContextualHeight * scale));
          const parent = this._DOM.getParentNode(currentElement);
          if (parent && this._node.isNeutral(parent)) {
            this._DOM.setStyles(parent, { height: `${scaledHeight}px` });
            return;
          }
          const scaler = this._node.createNeutral();
          this._DOM.setStyles(scaler, {
            display: 'inline-block',
            verticalAlign: 'top',
            width: '100%',
            height: `${scaledHeight}px`,
          });
          this._DOM.wrap(currentElement, scaler);
        };

        // Try to fit currentElement into the remaining space
        // on the current(last) page (availableSpace).
        if(availableSpaceFactor > 0.8) {
          this._debug._parseNode && console.log(
            '🥁 availableSpaceFactor > 0.8: ', availableSpaceFactor
          );
          // If, in order for it to fit, it needs to be scaled by no more than 20%,
          // we can afford to scale:
          applyScaleWithWrapper(availableSpaceFactor);
          // and start a new page with the next element:
          this._registerPageStart({
            element: nextElement,
            type: 'next',
            context: 'IMMEDIATELY scale currentElement to the remaining space; availableSpaceFactor > 0.8; currentElement.style.height'
          });
          this._node.markProcessed(currentElement, `processed as a image, has been scaled down within 20%, the next one starts a new page`);
          this._node.markProcessed(nextElement, `the previous one was scaled down within 20%, and this one starts a new page.`);
          this._debug._parseNode && console.log('%c END _parseNode (has height & scale)', CONSOLE_CSS_END_LABEL);
          this._debug._parseNode && console.groupEnd();
          return
        }

        // Otherwise the element will be placed on the next page.
        // And now we'll scale it anyway if it doesn't fit in its entirety.

        if(fullPageFactor < 1) {
          this._debug._parseNode && console.log(
            '🥁 fullPageFactor < 1: ', fullPageFactor
          );
          this._node.markProcessed(currentElement, `processed as a image, has been scaled down, and starts new page`);
          applyScaleWithWrapper(fullPageFactor);
        }

        this._debug._parseNode && console.log(
          '🥁 _registerPageStart', currentElement
        );
        this._registerPageStart({
          element: currentElement,
          improveResult: true,
          context: 'has height & processed "as a image", has been scaled down, and starts new page'
        });
        this._node.markProcessed(currentElement, `processed as a image, starts new page`);
        this._debug._parseNode && console.log('%c END _parseNode (has height & put on next page)', CONSOLE_CSS_END_LABEL);
        this._debug._parseNode && console.groupEnd();
        return
      }

      // * Check the possibility of (1) or (2): split or not?

      this._debug._parseNode && console.log(
        'split or not? \n',
        'currentBlockBottom', currentBlockBottom
      );

      //// MOVE UP:
      //// IF currentElement does fit
      //// in the remaining space on the page,

      this._debug._parseNode && console.log(
        'currentParentBottomEdge || currentElementBottom',
        {currentParentBottomEdge, currentElementBottom},
        'currentBlockBottom > this.pages.at(-1).pageBottom', currentBlockBottom, '>', this.pages.at(-1).pageBottom
      );

      // TODO TEST ME: #fewLines
      if (this._DOM.getElementOffsetHeight(currentElement) < this._minimumBreakableHeight) {
        this._registerPageStart({
          element: currentElement,
          improveResult: true,
          context: 'starts new page, #fewLines; nextElementTop > this.pages.at(-1).pageBottom'
        });
        this._node.markProcessed(currentElement, `starts new page, #fewLines`);
        this._debug._parseNode && console.log('%c END _parseNode #fewLines', CONSOLE_CSS_END_LABEL);
        this._debug._parseNode && console.groupEnd();
        return
      }

      // otherwise try to break it and loop the children:
      const children = this._node.getSplitChildren(currentElement, this.pages.at(-1).pageBottom, this._referenceHeight, this._root);
      this._debug._parseNode && console.log(
        'try to break it and loop the children:', children
      );

      // **
      // * The children are processed.
      // * Depending on the number of children:

      const childrenNumber = children.length;

      // * Parse children:
      if (childrenNumber) {
        // * Process children if exist

        // * Pass from the top level or set current as parent if at the top level there was a reset
        const _arrayTopParent = arrayTopParent ? arrayTopParent : currentElement;
        const _arrayBottomParent = arrayBottomParent ? arrayBottomParent : currentElement;

        // * In a fully split node, or in a node that has received the 'slough' attribute,
        // * children replace it.
        // * So we don't take into account the last child bottom margins (arrayParentBottomEdge).
        const isSlicedParent = this._node.isSliced(currentElement) || this._node.isSlough(currentElement);

        this._debug._parseNode && console.log({isSlicedParent, arrayTopParent,})
        this._parseNodes({
          array: children,
          previous: previousElement,
          next: nextElement,
          arrayTopParent: isSlicedParent ? undefined : _arrayTopParent,
          arrayBottomParent: isSlicedParent ? undefined : _arrayBottomParent,
        });
        this._node.markProcessed(currentElement, `getSplitChildren and _parseNodes`);
      } else {
        // * If no children,
        // * move element to the next page.
        // ** But,

        this._debug._parseNode && console.log(
          ...consoleMark,
          '_registerPageStart (from _parseNode): \n',
          currentElement
        );
        this._registerPageStart({
          element: currentElement,
          improveResult: true,
          context: 'does not fit, has no children, register it (or parents if improved)'
        });
        this._node.markProcessed(currentElement, `doesn't fit, has no children, register it or parents`);
      }
    }

    this._debug._parseNode && console.log(`%c END _parseNode [•••]`, CONSOLE_CSS_END_LABEL, { currentElement });
    this._debug._parseNode && console.groupEnd();
  }

}
