import { withLegacySelector } from './selector.js';

export default class Paper {

  constructor({
    config,
    DOM,
    node,
    selector,
    layout,
  }) {
    // * From config:
    this._debug = config.debugMode ? { ...config.debugConfig.paper } : {};

    // * private
    this._DOM = DOM;
    this._selector = selector;
    this._node = node;

    // templates
    this._frontpageTemplate = layout.frontpageTemplate;
    this._headerTemplate = layout.headerTemplate;
    this._footerTemplate = layout.footerTemplate;

    // selectors
    this._pageChromeSelector = selector?.pageChrome || '.pageChrome';
    this._pageBodySpacerSelector = selector?.pageBodySpacer || '.pageBodySpacer';
    this._pageHeaderSelector = selector?.pageHeader || '.pageHeader';
    this._pageFooterSelector = selector?.pageFooter || '.pageFooter';
    this._headerContentSelector = selector?.headerContent || '.headerContent';
    this._footerContentSelector = selector?.footerContent || '.footerContent';
    this._frontpageElementSelector = selector?.frontpageElement || '.frontpageElement';
    this._frontpageContentSelector = selector?.frontpageContent || '.frontpageContent';

    this._virtualPaperSelector = selector?.virtualPaper || '.virtualPaper';
    this._virtualPaperTopMarginSelector = selector?.virtualPaperTopMargin || '.virtualPaperTopMargin';
    this._virtualPaperBottomMarginSelector = selector?.virtualPaperBottomMargin || '.virtualPaperBottomMargin';

    this._pageNumberRootSelector = selector?.pageNumberRoot
      ? withLegacySelector(selector.pageNumberRoot)
      : undefined;
    this._pageNumberCurrentSelector = selector?.pageNumberCurrent
      ? withLegacySelector(selector.pageNumberCurrent)
      : undefined;
    this._pageNumberTotalSelector = selector?.pageNumberTotal
      ? withLegacySelector(selector.pageNumberTotal)
      : undefined;

    // * private page params
    this._paperHeight;
    this._frontpageFactor;

    // * public page params
    this.headerHeight;
    this.footerHeight;
    this.bodyHeight;
    this.bodyWidth;

    this._calculatePaperParams();
  }

  createPageChrome({ pageNumber, pageCount }) {
    const wrapper = this._node.create(this._pageChromeSelector);
    this._node.markPageNumber(wrapper, pageNumber);
    const pageElements = this._composePageElements({ pageNumber, pageCount });
    this._DOM.insertAtEnd(
      wrapper,
      pageElements
    );

    return wrapper;
  }

  _composePageElements({ pageNumber, pageCount }) {
    const fragment = this._DOM.createDocumentFragment();

    const body = this._createPageBodySpacer(this.bodyHeight);
    this._node.markPageNumber(body, pageNumber);
    const header = this._createPageHeader(this._headerTemplate);
    const footer = this._createPageFooter(this._footerTemplate);

    this._DOM.insertAtEnd(
      fragment,
      this.createVirtualTopMargin(),
      header,
      body,
      footer,
      this.createVirtualBottomMargin(),
    );

    if (pageNumber && pageCount) {
      this._setPageNumber(header, pageNumber, pageCount);
      this._setPageNumber(footer, pageNumber, pageCount);
    }

    return fragment;
  }

  createFrontpage() {
    if (!this._frontpageTemplate) {
      this._debug && console.warn('[paper • createFrontpage()] called without a template');
      return
    }

    const frontpageElement = this._node.create(this._frontpageElementSelector);
    this._DOM.setStyles(frontpageElement, {
      'height': this.bodyHeight + 'px',
      // ✴️ inline-block is used to prevent incorrect page breaks in print:
      // For oversized front pages, the overflowing frontpageContent is scaled down,
      // while frontpageElement has a fixed height that should fit on one page.
      // When frontpageElement is display:block, browsers calculate fragmentation
      // from the child’s unscaled layout height (before transforms),
      // which can cause unwanted page breaks.
      // Setting display:inline-block makes the wrapper an atomic inline-level box
      // (CSS Display §2.4, CSS Fragmentation §3.1),
      // so it isn’t fragmented inside, and the scaled child prints as one unit.
      'display': 'inline-block',
      'width': '100%',
      'vertical-align': 'top',
    });
    const frontpageContent = this._createFrontpageContent(this._frontpageTemplate, this._frontpageFactor);
    this._DOM.setStyles(frontpageContent, {
      // ✴️ flow-root → isolates layout (prevents margin collapse / contains floats)
      'display': 'flow-root',
      'transform-origin': 'top center',
      'height': '100%',
    });
    this._DOM.insertAtStart(frontpageElement, frontpageContent);
    return frontpageElement;
  }

  createVirtualTopMargin() {
    return this._node.create(this._virtualPaperTopMarginSelector);
  }

  createVirtualBottomMargin() {
    return this._node.create(this._virtualPaperBottomMarginSelector);
  }

  createVirtualPaper(pageElements) {

    const paper = this._node.create(this._virtualPaperSelector);

    pageElements && this._DOM.insertAtEnd(
      paper,
      this.createVirtualTopMargin(),
      pageElements,
      this.createVirtualBottomMargin(),
    );

    return paper;
  }

  _createFrontpageContent(template, factor) {
    const _node = this._node.create(this._frontpageContentSelector);
    template && this._DOM.setInnerHTML(_node, template);
    factor && this._DOM.setStyles(_node, { transform: `scale(${factor})` });

    return _node;
  }

  _createPageBodySpacer(height, content) {
    const _node = this._node.create(this._pageBodySpacerSelector);
    // Lock the height of the pageBodySpacer for the content area.
    // This affects the correct printing of the paper layer.
    this._DOM.setStyles(_node, { height: height + 'px' });
    // To create a frontpage, we can pass content here.
    content && this._DOM.insertAtEnd(_node, content);
    return _node;
  }

  _createPageHeader(template) {
    const _node = this._node.create(this._pageHeaderSelector);

    if (template) {
      const content = this._node.create(this._headerContentSelector);
      this._DOM.setInnerHTML(content, template);
      this._DOM.insertAtEnd(_node, content);
    }
    return _node;
  }

  _createPageFooter(template) {
    const _node = this._node.create(this._pageFooterSelector);

    if (template) {
      const content = this._node.create(this._footerContentSelector);
      this._DOM.setInnerHTML(content, template);
      this._DOM.insertAtEnd(_node, content);
    }
    return _node;
  }

  _setPageNumber(target, current, total) {
    const container = this._pageNumberRootSelector
      ? this._DOM.getElement(this._pageNumberRootSelector, target)
      : this._pageNumberRootSelector;

    if (container) {
      // A template may show only the current page number or only the total.
      const currentNum = this._DOM.getElement(this._pageNumberCurrentSelector, container);
      const totalNum = this._DOM.getElement(this._pageNumberTotalSelector, container);
      currentNum && this._DOM.setInnerHTML(currentNum, current);
      totalNum && this._DOM.setInnerHTML(totalNum, total);
    }
  }

  _calculatePaperParams() {

    // CREATE TEST PAPER ELEMENTS
    const bodyElement = this._createPageBodySpacer();
    const headerElement = this._createPageHeader(this._headerTemplate);
    const footerElement = this._createPageFooter(this._footerTemplate);

    const testPaper = this._node.create(this._virtualPaperSelector);

    this._DOM.insertAtEnd(
      testPaper,
      this.createVirtualTopMargin(),
      headerElement,
      bodyElement,
      footerElement,
      this.createVirtualBottomMargin(),
    );

    // CREATE TEMP CONTAINER
    const workbench = this._node.create('#workbench')
    this._DOM.setStyles(
      workbench,
      {
        position: 'absolute',
        left: '-3000px',
      }
    );
    this._DOM.insertAtEnd(workbench, testPaper);
    this._DOM.insertAtStart(this._DOM.body, workbench);

    // get heights for an blank page
    // * BCR vs offset*
    // * The footer/header can have a fractional height.
    // * When using offset* values, fractions are rounded.
    // * This can cause a 1-pixel mismatch between the actual and calculated height of the body,
    // * which in turn causes assertions to fail due to a mismatch between the ‘page height / gap position’
    // * when building paper- and chrome- flows.
    // * So we use BCR.
    const paperHeight = this._DOM.getElementBCR(testPaper).height;
    const headerHeight = this._DOM.getElementBCR(headerElement).height || 0;
    const footerHeight = this._DOM.getElementBCR(footerElement).height || 0;
    const bodyHeight = this._DOM.getElementBCR(bodyElement).height;
    const bodyWidth = this._DOM.getElementBCR(bodyElement).width;

    // add frontpage text
    const frontpageElement = this._createFrontpageContent(this._frontpageTemplate);
    this._DOM.insertAtStart(bodyElement, frontpageElement);
    // get height for the frontpage content
    const filledBodyHeight = this._DOM.getElementBCR(bodyElement).height;

    const frontpageFactor = (filledBodyHeight > bodyHeight)
      ? bodyHeight / filledBodyHeight
      : 1;

    // REMOVE TEMP CONTAINER
    this._DOM.removeNode(workbench);

    // --------

    if (headerHeight > paperHeight * 0.2) {
      console.warn('It seems that your custom header is too high')
    }
    if (footerHeight > paperHeight * 0.15) {
      console.warn('It seems that your custom footer is too high')
    }
    if (frontpageFactor < 1) {
      console.warn('It seems that your frontpage content is too large. We made it smaller to fit on the page. Check out how it looks! It might make sense to fix this with styles or reduce the text amount.')
    }

    this._paperHeight = paperHeight;
    this.headerHeight = headerHeight;
    this.footerHeight = footerHeight;
    this.bodyHeight = bodyHeight;
    this.bodyWidth = bodyWidth;
    this._frontpageFactor = frontpageFactor;
  }
}
