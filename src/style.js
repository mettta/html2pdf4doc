import SELECTOR, { withLegacySelector } from './selector.js';

export default class Style {

  constructor(config) {
    this.config = config;

    // TODO put SELECTOR here (use config for templates ID)


    // * parameters from the config were converted to pixels:
    this._printWidth = parseFloat(this.config.paperWidth);
    this._printLeft = parseFloat(this.config.printLeftMargin);
    this._printRight = parseFloat(this.config.printRightMargin);
    this._printContentWidth = `${this._printWidth - this._printLeft - this._printRight}px`;

    // * virtual param for preview
    this._flowPreviewPaddingBottom = '100px';

    // * safe space for the first / last element's border:
    this._chromeBorderSafeSpace = '2px';

    // * establish a new block formatting context (BFC) so neighboring margins
    // * can't collapse into the element
    this._ensureBFC = `display: flow-root`;

    // *****
    this.charWidth = '10px'; // TODO get from calculations
  }

  create() {
    // TODO config {value, unit}

    return this._pageRule()
         + this._layoutStyles().screen
         + this._layoutStyles().print
         + this._chromeStyles().screen
         + this._chromeStyles().print
         + this._serviceElementsStyle().screen
         + this._serviceElementsStyle().print
         + this._cutEdgeStyle()
         + (this.config.debugMode ? this._testScreenOnlyStyle() : '');
  }

  _pageRule() {
    // Make sure that the print margins (set for @page)
    // are NO LARGER than the corresponding indents
    // used for the the printable area,
    // to avoid overfilling the printable area and the mismatch
    // between preview and the flow processed by paged media.
    // * When creating the config, they are reduced by up to 1 pixel for safety
    // * reasons, rounded down during conversion.

    // * 2 values: width then height
    const _size = `${this.config.paperWidth} ${this.config.paperHeight}`;

    // * In this way we allow content to be theoretically printed on the bottom margin.
    // * And we leave it up to the printer to decide whether to print there or not.
    // * And in this way we avoid extra blank pages when some pixel
    // * of the invisible lower margin does not "fit" in the area to be printed.
    const _marginBottom = 0; // *** instead of this.config.printBottomMargin

    return `@page {
  size: A4;
  size: ${_size};
  margin-left: ${this.config.printLeftMargin};
  margin-right: ${this.config.printRightMargin};
  margin-top: ${this.config.printTopMargin};
  margin-bottom: ${_marginBottom};
}`;
  }

  _layoutStyles() {

    const _rootDisplay = 'flow-root'; // * protection against unpredictability of margins
    const _rootPosition = 'relative'; // * for proper printable flow positioning
    const _rootZIndex = '1'; // * to compensate for possible BG in the parent node

    const screen = `
${SELECTOR.root} {
  --paper-color: ${this.config.paperColor};
  display: ${_rootDisplay};
  position: ${_rootPosition};
  z-index: ${_rootZIndex};
  width: ${this._printContentWidth};
  margin: 0 auto;
  font-size: ${this.config.printFontSize};
  padding-bottom: ${this._flowPreviewPaddingBottom};
}

${SELECTOR.contentFlow} {
  display: block;
}

${SELECTOR.paperFlow} {
  display: block;
  position: absolute;
  width: 100%;
  z-index: -1;
  padding-bottom: ${this._flowPreviewPaddingBottom};
  pointer-events: none;
}

${SELECTOR.overlayFlow} {
  display: block;
  position: absolute;
  width: 100%;
  z-index: 2147483647;
  padding-bottom: ${this._flowPreviewPaddingBottom};
  pointer-events: none;
}

${SELECTOR.virtualPaper} {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: minmax(min-content, max-content) minmax(min-content, max-content) 1fr minmax(min-content, max-content) minmax(min-content, max-content);
  place-items: stretch stretch;
  place-content: stretch stretch;
  width: ${this._printContentWidth};
  height: ${this.config.paperHeight};
  font-size: ${this.config.printFontSize};
}

${SELECTOR.virtualPaper}::before {
  position: absolute;
  content: '';
  width: ${this.config.paperWidth};
  height: ${this.config.paperHeight};
  left: -${this.config.printLeftMargin};
  background: var(--paper-color, white);
  box-shadow: rgba(0, 0, 0, 0.1) 2px 2px 12px 0px;
  z-index: -1;
}

${SELECTOR.pageChrome} {
  display: block;
  pointer-events: none;
}

${SELECTOR.pageBodySpacer} {
  display: block;
  pointer-events: none;
}

${SELECTOR.pageFooter},
${SELECTOR.pageHeader} {
  display: block;
  position: relative;
  pointer-events: auto;
}

${SELECTOR.pageFooter}::before,
${SELECTOR.pageHeader}::before {
  content: '';
  position: absolute;
  inset: 0;
  left: -10px;
  right: -10px;
  z-index: -1;
  background: var(--paper-color, white);
}

${SELECTOR.pageFooter}::before {
  top: ${this._chromeBorderSafeSpace};
}

${SELECTOR.pageHeader}::before {
  bottom: ${this._chromeBorderSafeSpace};
}

${SELECTOR.virtualPaperTopMargin} {
  display: block;
  height: ${this.config.printTopMargin};
}

${SELECTOR.virtualPaperBottomMargin} {
  display: block;
  height: ${this.config.printBottomMargin};
}

${SELECTOR.virtualPaperGap} {
  display: block;
  padding-top: ${this.config.virtualPagesGap};
}

${SELECTOR.contentFlowStart},
${SELECTOR.contentFlowEnd},
${SELECTOR.pageDivider},
${SELECTOR.runningSafety} {
  ${this._ensureBFC};
}
    `;

    const print = `
@media print {

  ${SELECTOR.root},
  ${SELECTOR.overlayFlow},
  ${SELECTOR.paperFlow} {
    padding: 0;
  }

  ${SELECTOR.paperFlow},
  ${SELECTOR.printHide} {
    display: none !important;
  }

  ${SELECTOR.printIgnore} {
    display: contents !important;
  }

  ${SELECTOR.virtualPaperTopMargin},
  ${SELECTOR.virtualPaperBottomMargin},
  ${SELECTOR.virtualPaperGap} {
    display: none !important;
  }

  ${SELECTOR.pageChrome},
  ${SELECTOR.frontpageElement},
  ${SELECTOR.pageBodySpacer} {
    break-inside: avoid;
  }
}
    `;

    return { screen, print }
  }

  _chromeStyles() {
    const screen = `
${SELECTOR.headerContent},
${SELECTOR.footerContent} {
  display: block;
  font-size: small;
}

${SELECTOR.headerContent} p,
${SELECTOR.footerContent} p {
  margin: 0;
}

${SELECTOR.headerContent} {
  padding-bottom: ${this.config.headerMargin};
  padding-top: 10px; /* for page numbers */
}

${SELECTOR.footerContent} {
  padding-top: ${this.config.footerMargin};
  min-height: 32px; /* for page numbers */
}

${SELECTOR.tocPageNumber} {
  min-width: 3ch;
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
}

${withLegacySelector(SELECTOR.pageNumberRoot)} {
  display: flex;
  column-gap: 2px;
  position: absolute;
  right: 0;
  text-align: right;
  line-height: 1;
}

${withLegacySelector(`${SELECTOR.headerContent} ${SELECTOR.pageNumberRoot}`, SELECTOR.pageNumberRoot)} {
  top: 0;
}

${withLegacySelector(`${SELECTOR.footerContent} ${SELECTOR.pageNumberRoot}`, SELECTOR.pageNumberRoot)} {
  bottom: 0;
}
    `;

    const print = ``;

    return { screen, print }
  }

  _cutEdgeStyle() {
    return `
${SELECTOR.topCutPart} {
  margin-top: 0 !important;
}
${SELECTOR.bottomCutPart} {
  margin-bottom: 0 !important;
}
${SELECTOR.cleanTopCut} {
  margin-top: 0 !important;
  padding-top: 0 !important;
  border-top: none !important;
}
${SELECTOR.cleanBottomCut} {
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
  border-bottom: none !important;
}
    `;
  }

  _serviceElementsStyle() {

    const screen = `
.null {
  display: inline;
  padding: 0;
  margin: 0;
  font: 0;
  color: transparent;
  line-height: 0;
  border: none;
  outline: none;
  background: none;
  background-color: transparent;
}

${SELECTOR.word},
${SELECTOR.textNode},
${SELECTOR.textLine},
${SELECTOR.textGroup},
${SELECTOR.neutral},
${SELECTOR.neutral} span {
  display: inline;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  line-height: inherit;
  background: none;
  background-color: transparent;
}

${SELECTOR.textGroup} {
  display: block;
}

${SELECTOR.complexTextBlock} {
  display: block;
}

${SELECTOR.complexTextBlock} ${SELECTOR.complexTextBlock} {
  display: inline;
}

${SELECTOR.printPageBreak} {
  ${this._ensureBFC};
}

${SELECTOR.printForcedPageBreak} {
  display: block;
  visibility: hidden;
  height: 0;
  overflow: hidden;
}
    `;

    const print = `
@media print {

  ${SELECTOR.printPageBreak} {
    break-after: page;
  }

}
    `;

    return { screen, print }
  }

  _testScreenOnlyStyle() {
    return `
/* DEBUG PREVIEW */
@media screen {

  ${SELECTOR.contentFlow} {
    background:repeating-linear-gradient(
      -45deg,
      rgba(222, 222, 222, .1),
      rgba(222, 222, 222, .1) 10px,
      rgba(222, 222, 222, .2) 10px,
      rgba(222, 222, 222, .2) 20px
    );
  }

  ${SELECTOR.overlayFlow} {
    background:repeating-linear-gradient(
      45deg,
      rgba(222, 222, 222, 0),
      rgba(222, 222, 222, 0) 18px,
      rgba(0, 166, 255, 0.05) 18px,
      rgba(0, 166, 255, 0.05) 20px
    );
  }

  ${SELECTOR.virtualPaperGap} {
    background: #ff000020;
  }

  ${SELECTOR.pageFooter},
  ${SELECTOR.pageHeader} {
    background: #fff1ff99;
  }
  ${SELECTOR.pageBodySpacer} {
    background: #ffee0020;
  }
  ${SELECTOR.runningSafety} {
    background: #f200ff;
    outline: 0.1px dashed #f200ff88;
  }
  ${SELECTOR.frontpageElement} {
    background: #00fcff20;
  }

  ${SELECTOR.neutral} {
    background: #00ffee10;
  }

  ${SELECTOR.textNode} {
    background: #00ff0010;
  }

  ${SELECTOR.textGroup},
  ${SELECTOR.textLine} {
    background: #0000ff08;
  }
}
    `;
  }
}
