import { addInlineCSSMask, generateCSSMask } from './mask.js';
import * as Logging from './utils/logging.js';

export default class Preview {

  // TODO SHOW STATS (with close option)

  constructor({
    config,
    DOM,
    selector,
    node,

    pages,
    layout,
    paper,
  }) {

    // * From config:
    this._config = config;
    this._debug = config.debugMode ? { ...config.debugConfig.preview } : {};
    this._assert = config.consoleAssert ? true : false;
    Object.assign(this, Logging);
    // * asserts:
    this._accumulatedAssertions = {};

    this._DOM = DOM;
    this._selector = selector;
    this._node = node;

    // selectors
    this._virtualPaperGapSelector = selector.virtualPaperGap;
    this._runningSafetySelector = selector.runningSafety;
    this._printPageBreakSelector = selector.printPageBreak;
    this._pageDivider = selector.pageDivider;

    // selectors used for the mask
    this._virtualPaper = selector.virtualPaper;
    this._virtualPaperTopMargin = selector.virtualPaperTopMargin;
    this._pageBodySpacer = selector.pageBodySpacer;

    // data
    this._pages = pages;
    this._root = layout.root;
    this._contentFlow = layout.contentFlow;
    this._paperFlow = layout.paperFlow;
    this._overlayFlow = layout.overlayFlow;
    this._paper = paper;

    this._hasFrontPage = !!layout.frontpageTemplate;

  }

  create() {
    this._processFrontPage();
    this._processPages();
    (this._config.mask === true || this._config.mask === 'true') && this._addMask();
    this._makeRootVisible();
    return this._accumulatedAssertions;
  }

  _addMask() {
    // We rely on config values and on parameters provided by the Paper class,
    // rather than checking DOM elements,
    // since all units are converted to pixels before rendering.
    // This ensures consistent behavior for both paper rendering and
    // mask calculation per content stream, regardless of document length.

    // * Config params:
    const _virtualPagesGap = parseInt(this._config.virtualPagesGap);
    const _printPaperHeight = parseInt(this._config.paperHeight);
    const _printTopMargin = parseInt(this._config.printTopMargin);
    const _printBottomMargin = parseInt(this._config.printBottomMargin);
    const _headerMargin = parseInt(this._config.headerMargin);
    const _footerMargin = parseInt(this._config.footerMargin);

    // * Public Paper params:
    // const _pageBodySpacerWidth = this._paper.bodyWidth; // = 100% for now
    const _pageHeaderHeight = this._paper.headerHeight;
    const _pageFooterHeight = this._paper.footerHeight;
    const _pageBodySpacerHeight = this._paper.bodyHeight;

    // To preserve glyph bleed and visual spillover in header/footer areas,
    // we factor in the template-defined _headerMargin and _footerMargin.
    // These values are only used if the corresponding HTML template is present
    // (i.e., _pageHeaderHeight already includes _headerMargin, and likewise for footer).
    // We subtract half of each margin from the header/footer space,
    // and add it to the maskWindow to avoid clipping glyph tails or decorative outlines.
    const _topMargin = _pageHeaderHeight ? Math.ceil(_headerMargin / 2) : 0;
    const _bottomMargin = _pageFooterHeight ? Math.ceil(_footerMargin / 2) : 0;

    // * Refined Paper params:
    const _headerHeight = _pageHeaderHeight - _topMargin;
    const _footerHeight = _pageFooterHeight - _bottomMargin;
    const _bodyHeight = _pageBodySpacerHeight + _topMargin + _bottomMargin;

    // We mask elements that extend beyond the body,
    // including in the header and footer area.
    // This is to hide in these areas the borders and backgrounds of the wrappers
    // within which the page separator is placed.
    const _previewMaskFirstShift = _printTopMargin + _headerHeight;
    const _previewMaskStep = _printPaperHeight + _virtualPagesGap;

    // * Disable mask in print mode:
    // * Blink duplicates text in PDF when applying soft masks (mask-image)
    // const _printMaskFirstShift = _headerHeight;
    // const _printMaskStep = _printPaperHeight - _printTopMargin - _printBottomMargin;

    this.strictAssert(
      (_printPaperHeight === _bodyHeight + _headerHeight + _printTopMargin + _footerHeight + _printBottomMargin),
      'Paper size calculation params do not match'
    );

    const previewContentFlowMaskCSS = generateCSSMask({
      maskFirstShift: _previewMaskFirstShift,
      maskStep: _previewMaskStep,
      maskWindow: _bodyHeight,
    });

    const maskCSS = `
    @media screen {
      ${this._selector.contentFlow} {
        ${previewContentFlowMaskCSS}
      }
    }
    @media print {
      ${this._selector.root}::after {
        /* Safety placeholder for the bottom margin of the paper.
          Remove if the margins at the bottom of the page are replaced with padding.
          Placed under the footer.
        */
        --paper-color: ${this._config.paperColor};
        background: var(--paper-color, white);
        content: '';
        position: fixed;
        pointer-events: none;
        z-index: 11;
        inset: 0;
        top: unset;
        height: ${_printBottomMargin + _pageFooterHeight}px;
      }
    }`;

    this._node.insertStyle(maskCSS, 'mask');
  }

  _makeRootVisible() {
    this._DOM.setStyles(this._root, {'visibility': 'visible'});
  }

  _processFrontPage() {
    // IF FRONTPAGE,
    if (this._hasFrontPage) {
      // insert Frontpage into Content Flow,
      const frontpage = this._paper.createFrontpage();
      this._DOM.insertAtStart(this._contentFlow, frontpage);
      // move the zero page to the index 1:
      // register the added Frontpage in pages array,
      // thereby increasing the number of pages by 1.
      this._pages.unshift({ // todo unshift performance?
        pageStart: frontpage,
        pageEnd: frontpage,
      });
      // set Frontpage as previews Page End for page 1:
      this._pages[1].prevPageEnd = frontpage;
    }
  }

  _processPages() {
    for (let index = 0; index < this._pages.length; index++) {

      // insert paper and get separator for balancing
      const paperSeparator = this._insertIntoPaperFlow(index);

      // insert page and get separator for balancing
      const pageSeparator = this._insertIntoOverlayFlow(index);

      // ADD FOOTER and HEADER spacers into Content Flow (as page break)
      // and balance footer
      this._insertIntoContentFlow(index, pageSeparator, paperSeparator);
    }
  }

  _insertIntoPaperFlow(index) {
    // ADD VIRTUAL PAGE into Paper Flow,
    // with corresponding page number and pre-filled or blank,
    // with or without pre-separator.
    const paper = this._paper.createVirtualPaper();
    const paperSeparator = index ? this._createVirtualPaperGap() : undefined;
    this._insertPaper(
      this._paperFlow,
      paper,
      paperSeparator,
    );
    return paperSeparator
  }

  _insertIntoOverlayFlow(index) {
    // ADD VIRTUAL PAGE into Paper Flow,
    // with corresponding page number and pre-filled or blank,
    // with or without pre-separator.
    const page = this._paper.createPageChrome({
      pageNumber: index + 1,
      pageCount: this._pages.length
    });
    const pageSeparator = index ? this._createVirtualPaperGap() : undefined;
    this._insertPaper(
      this._overlayFlow,
      page,
      pageSeparator,
    );
    return pageSeparator
  }

  _insertIntoContentFlow(pageIndex, pageSeparator, paperSeparator) {
    const element = this._pages[pageIndex].pageStart;
    // ADD FOOTER and HEADER into Content Flow (as page break),
    // ADD ONLY HEADER into Content Flow before the first page.

    this._preventPageOverflow(pageIndex);

    const isSeparator = (paperSeparator && pageSeparator) ? true : false;
    const pageDivider = this._createPageBreaker(pageIndex, isSeparator);
    // This wrapper pageDivider must be inserted into the DOM immediately,
    // because in the process of creating and inserting the footer into the DOM,
    // balancing is going on, and the parent of the spacer
    // must already be in the DOM.
    this._DOM.insertBefore(element, pageDivider);

    isSeparator && this._insertFooterSpacer({
      target: pageDivider,
      footerHeight: this._paper.footerHeight,
      pageSeparator,
      paperSeparator,
      pageIndex,
    });
    this._insertHeaderSpacer(pageDivider, this._paper.headerHeight);
    this._updatePageNumberElementAttrValue(pageIndex);
  }

  _preventPageOverflow(pageIndex) {
    // * Reset margins on both sides of the page break to prevent overflow.
    // * This styles should not be applied before the preview is generated.
    const currentPageFirstElement = this._pages[pageIndex].pageStart;
    const previousPageLastElement = this._pages[pageIndex].toResetBottom || this._pages[pageIndex].pageEnd;

    // * Page numbers start at 1, but pageIndex is 0-based.
    // * For prevPageEnd, use pageIndex (== 'page num - 1') directly to avoid off-by-one.
    // const previousPageLastElement = this._pages[pageIndex].prevPageEnd;

    if (currentPageFirstElement) {
      this._DOM.setStyles(currentPageFirstElement, {'margin-top': ['0', 'important']});
      const topChain = this._node.getTopCollapseChain(currentPageFirstElement, this._root);
      topChain.forEach((element) => {
        this._DOM.setStyles(element, {'margin-top': ['0', 'important']});
      });
    } else {
      this.strictAssert(0, '[preview] [_preventPageOverflow] current page First Element do not pass! page:', pageIndex)
    }

    if (previousPageLastElement) {
      // this._node.markPageEnd(previousPageLastElement, pageIndex + 'test');
      this._DOM.setStyles(previousPageLastElement, {'margin-bottom': ['0', 'important']});
      const bottomChain = this._node.getBottomCollapseChain(previousPageLastElement, this._root);
      bottomChain.forEach((element) => {
        this._DOM.setStyles(element, {'margin-bottom': ['0', 'important']});
      });
      if (this._node.isIMG(previousPageLastElement)) {
        // Inline images sit on the text baseline, leaving a descender gap;
        // `vertical-align: top` removes that extra bottom space.
        this._DOM.setStyles(previousPageLastElement, {'vertical-align': ['top', 'important']});
      }
    } else {
      (pageIndex > 0) && this._debug._ && console.warn(`[preview] There is no page end element before ${pageIndex}. Perhaps it's a 'beginningTail'.`, )
    }
  }

  _createPageBreaker(pageIndex, isSeparator) {
    // PageBreaker isolates all inserted elements
    // to create a new formatting context,
    // and also used to determine which page an object is on.

    // TODO move to DOM:
    const pageDivider = this._node.create(this._pageDivider);
    this._DOM.setAttribute(pageDivider, '[page]', `${pageIndex + 1}`);
    this._node.registerPageDivider(pageDivider, pageIndex + 1);

    // Non-virtual margins need to be added to the outer wrapper pageDivider,
    // because if the code of the document being printed puts
    // this breaking element into an inline context,
    // the margins will not work correctly
    // (instead of internal elements - header and footer, whose margins are lost
    // in cases like inline formatting of one of the parents).

    (isSeparator && this._paper.footerHeight) && this._DOM.setStyles(pageDivider, { marginTop: this._paper.footerHeight + 'px' });
    this._paper.headerHeight && this._DOM.setStyles(pageDivider, { paddingBottom: this._paper.headerHeight + 'px' });

    return pageDivider;
  }

  _updatePageNumberElementAttrValue(pageIndex) {
    // * The frontpage will move the previously set `pageStart` markers forward by 1.
    // * If there is no frontpage, `pageStart` markers do not need to be updated.
    // * `pageEnd` markers are set for the first time.
    this._hasFrontPage && this._node.markPageStart(this._pages[pageIndex].pageStart, `${pageIndex + 1}`);
    this._node.markPageEnd(this._pages[pageIndex].pageEnd, `${pageIndex + 1}`);
  }

  _insertPaper(paperFlow, paper, separator) {
    if (separator) {
      // pages that come after the page break
      this._DOM.insertAtEnd(
        paperFlow,
        // this.createPrintPageBreak(), // has no effect
        separator,
        paper,
      );
    } else {
      // first page
      this._DOM.insertAtEnd(
        paperFlow,
        paper,
      );
    }
  }

  // create elements

  _createVirtualPaperGap() {
    return this._node.create(this._virtualPaperGapSelector);
  }

  _createVirtualPaperTopMargin() {
    return this._paper.createVirtualTopMargin()
  }

  _createVirtualPaperBottomMargin() {
    return this._paper.createVirtualBottomMargin()
  }

  _insertFrontpageSpacer(target, bodyHeight) {
    // create spacer element
    const spacer = this._node.create();
    this._DOM.setStyles(spacer, { paddingBottom: bodyHeight + 'px' });
    this._DOM.setAttribute(spacer, '.printFrontpageSpacer');

    // insert filler element into content
    this._DOM.insertAtStart(target, spacer);

    // return ref
    return spacer;
  }

  _insertHeaderSpacer(target, headerHeight) {

    const headerSpacer = this._DOM.createDocumentFragment();

    // In the virtual footer/header we add an empty element
    // with a calculated height instead of the content.
    // We use margins to compensate for possible opposite margins in the content.
    const balancingHeader = this._node.create(this._runningSafetySelector);

    this._DOM.insertAtEnd(
      headerSpacer,
      this._createVirtualPaperTopMargin(),
      balancingHeader,
    )

    // Put into DOM inside the target, in its lower part
    this._DOM.insertAtEnd(target, headerSpacer)
  }

  _insertFooterSpacer({
    target,
    footerHeight,
    pageSeparator,
    paperSeparator,
    pageIndex,
  }) {

    const footerSpacer = this._DOM.createDocumentFragment();

    // Based on contentSeparator (virtual, not printed element, inserted into contentFlow)
    // and paperSeparator (virtual, not printed element, inserted into paperFlow),
    // calculate the height of the necessary compensator to visually fit page breaks
    // in the content in contentFlow and virtual page images on the screen in paperFlow.
    const contentSeparator = this._createVirtualPaperGap();

    // In the virtual footer/header we add an empty element
    // with a calculated height instead of the content.
    // We use margins to compensate for possible opposite margins in the content.

    // In this element we will add a compensator.
    // We create it with a basic compensator,
    // which takes into account now only the footerHeight.
    const balancingFooter = this._node.create(this._runningSafetySelector);

    this._DOM.insertAtEnd(
      footerSpacer,
      balancingFooter,
      this._createVirtualPaperBottomMargin(),
      this._node.create(this._printPageBreakSelector), // PageBreak
      contentSeparator,
    )

    // Put into DOM inside the target, in its upper part
    this._DOM.insertAtStart(target, footerSpacer);

    this._balanceFooter({ balancingFooter, contentSeparator, pageSeparator, paperSeparator, pageIndex });
  }

  _balanceFooter({
    balancingFooter,
    contentSeparator,
    pageSeparator,
    paperSeparator,
    pageIndex,
  }) {
    // * Must be run after all members have been added to the DOM.
    // Determine what inaccuracy there is visually in the break simulation position,
    // focusing on the difference between the position of the paired elements
    // in Paper Flow and Content Flow, and compensate for it.

    const pageSeparatorTop = this._node.getTop(pageSeparator, this._root);
    const paperSeparatorTop = this._node.getTop(paperSeparator, this._root);
    const contentSeparatorTop = this._node.getTop(contentSeparator, this._root);

    this.strictAssert(paperSeparatorTop == pageSeparatorTop, `balancers in paper layers are misaligned`, {
      pageIndex, balancingFooter, contentSeparator, pageSeparator, paperSeparator,
      paperSeparatorTop, pageSeparatorTop,
    });

    const balancer = pageSeparatorTop - contentSeparatorTop;
    this._debug._ && console.log({balancingFooter, contentSeparatorTop, paperSeparatorTop, pageSeparatorTop});

    this._DOM.setStyles(balancingFooter, { 'margin-bottom': balancer + 'px' });

    // * Compensate accumulated rounding errors caused by integer DOM offsets
    // * (offset* properties truncate sub-pixel values, leading to a 1px jump)
    const roundingCompensationPx = 1; // px
    if (balancer < - roundingCompensationPx) {
      // * treat as negative, beyond rounding noise
      this._debug._ && console.warn(`[pages: ${pageIndex}-${pageIndex + 1}] balancer is negative: ${balancer} < 0. Submitted to the Validator.`, contentSeparator);
      this._accumulatedAssertions[pageIndex] = {
        balancer,
        contentSeparator,
        pageNumber: pageIndex,
      };
    }
  }

}
