
import SELECTOR from './selector.js';
import DocumentObjectModel from './DOM.js';
import Layout from './layout.js';
import Node from './node/index.js';
import Pages from './pages/index.js';
import Paper from './paper.js';
import Preview from './preview.js';
import Toc from './toc.js';
import Validator from './validator.js';
import Preloader from './preloader.js';
import Preprocess from './preprocess/index.js';
import isTruthy from './utils/isTruthy.js';
import buildAppConfig from './appConfig.js';
import { normalizeLegacyConfigParams } from './config.js';
import { forceLayoutParticipation } from './utils/forceLayoutParticipation.js';
import { createMutationQueue } from './mutations/queue.js';

const CONSOLE_CSS_LABEL = `color:Gray;border:1px solid;`

export default class App {
  constructor(params) {
    this.params = normalizeLegacyConfigParams(params);
    this.forcedDebugMode = isTruthy(params.forcedDebugMode);
    this.debugMode = isTruthy(params.debugMode) || this.forcedDebugMode;
    this.preloader = params.preloader;
    this.selector = SELECTOR;
    this.config;
  }

  async render() {
    console.time("[HTML2PDF4DOC] Total time");

    forceLayoutParticipation();

    this.debugMode && console.log('🏁 document.readyState:', document.readyState)

    document.addEventListener("readystatechange", (event) => {
      this.debugMode && console.log('🏁 readystatechange:', document.readyState)
    });

    // * ⏰ window.addEventListener("DOMContentLoaded")

    this.debugMode && console.time("⏱️ await DOMContentLoaded time");
    if (document.readyState === "loading") {
      await new Promise(resolve => {
        window.addEventListener("DOMContentLoaded", (event) => {
          this.debugMode && console.log("⏰ EVENT: DOMContentLoaded");
          resolve();
        });
      });
    } else {
      this.debugMode && console.log("🕰️ EVENT: DOMContentLoaded (event fired before init)");
    }
    this.debugMode && console.timeEnd("⏱️ await DOMContentLoaded time");

    this.debugMode && console.time("⏱️ create Preloader time");
    const preloader = new Preloader(this.params);
    if (this.preloader === 'true') {
      preloader.create();
    }
    this.debugMode && console.timeEnd("⏱️ create Preloader time");

    // * process config
    this.debugMode && console.time("⏱️ Config time");
    this.debugMode && console.groupCollapsed('%c config ', CONSOLE_CSS_LABEL + 'color:LightGray');
    // ** Merging the user configuration (config) with the debugging settings (debugConfig).
    // ** This allows centralized management of logging and other debugging options,
    // ** passing them through the config object to all required classes.
    this.config = buildAppConfig(this.params);
    this.debugMode && console.groupEnd();
    this.debugMode && console.info('⚙️ Current config with debugConfig:', this.config);
    this.debugMode && console.timeEnd("⏱️ Config time");

    // * `this.config.debugConfig.testSignals.forcedModeLog` is FALSE by default,
    // * and enables by forced debug mode.
    this.config.debugConfig.testSignals.forcedModeLog && console.info('[HTML2PDF4DOC] 🛠️ Forced debug mode is active.');
    // * `consoleAssert` enables in user config OR by forced debug mode.
    this.config.consoleAssert && console.info('[HTML2PDF4DOC] 🧧 Assertions enabled.');

    // * prepare helpers

    this.debugMode && console.time("⏱️ DOM helpers init time");
    const DOM = new DocumentObjectModel({
      DOM: window.document,
      config: this.config,
    });
    this.debugMode && console.timeEnd("⏱️ DOM helpers init time");

    this.debugMode && console.time("⏱️ node helpers init time");
    const node = new Node({
      config: this.config,
      DOM: DOM,
      selector: this.selector,
    });
    this.debugMode && console.timeEnd("⏱️ node helpers init time");

    // * ⏰ window.addEventListener("load")

    this.debugMode && console.time("⏱️ await window load time");
    if (document.readyState !== "complete") {
      await new Promise(resolve => {
        window.addEventListener("load", (event) => {
          this.debugMode && console.log("⏰ EVENT: window load");
          resolve();
        });
      });
    } else {
      this.debugMode && console.log("🕰️ EVENT: window load (event fired before init)");
    }
    this.debugMode && console.timeEnd("⏱️ await window load time");

    // * prepare layout (DOM manipulation)

    this.debugMode && console.time("⏱️ Layout time");
    this.debugMode && console.groupCollapsed('%c Layout ', CONSOLE_CSS_LABEL);
    const layout = new Layout({
      config: this.config,
      DOM: DOM,
      selector: this.selector,
      node: node,
    });
    layout.create();
    this.debugMode && console.groupEnd();
    this.debugMode && console.timeEnd("⏱️ Layout time");
    if (!layout.success) {
      this.debugMode && console.error('Failed to create layout.\n\nWe have to interrupt the process of creating PDF preview.');
      return
    } else {
      // this.debugMode && console.log('🚩 layout.success:', layout.success);
    }

    // * ensure fonts and external resources are ready for stable layout
    this.debugMode && console.time("⏱️ Preprocess time");
    this.debugMode && console.groupCollapsed('%c Preprocess ', CONSOLE_CSS_LABEL);
    await new Preprocess(this.config, DOM).run();
    this.debugMode && console.groupEnd();
    this.debugMode && console.timeEnd("⏱️ Preprocess time");

    // * calculate and prepare 'paper'
    this.debugMode && console.info('%c calculate Paper params ', CONSOLE_CSS_LABEL);
    this.debugMode && console.time("⏱️ Paper time");
    const paper = new Paper({
      config: this.config,
      DOM: DOM,
      selector: this.selector,
      node: node,
      layout: layout,
    });
    this.debugMode && console.timeEnd("⏱️ Paper time");
    if (!paper || !paper.bodyHeight || !paper.bodyWidth) {
      this.debugMode && console.error('Failed to create paper calculations.\n\nWe have to interrupt the process of creating PDF preview.');
      return
    } else {
      // this.debugMode && console.log('🚩 paper.bodyHeight:', paper.bodyHeight);
    }

    // * calculate pages (DOM manipulation)

    this.debugMode && console.time("⏱️ Pages time");
    this.debugMode && console.group('%c Pages ', CONSOLE_CSS_LABEL); // Collapsed
    // Defer selected DOM writes from pagination and apply them in Preview stage.
    const mutationQueue = createMutationQueue();
    const pages = new Pages({
      config: this.config,
      DOM: DOM,
      selector: this.selector,
      node: node,
      layout: layout,
      referenceHeight: paper.bodyHeight,
      referenceWidth: paper.bodyWidth,
      mutationQueue,
    }).calculate();
    this.debugMode && console.groupEnd();
    this.debugMode && console.timeEnd("⏱️ Pages time");

    // * render preview (DOM manipulation)

    this.debugMode && console.time("⏱️ Preview time");
    this.debugMode && console.groupCollapsed('%c Preview ', CONSOLE_CSS_LABEL);
    const previewValidations = new Preview({
      config: this.config,
      DOM: DOM,
      selector: this.selector,
      node: node,
      layout: layout,
      paper: paper,
      pages: pages,
      mutationQueue,
    }).create();
    this.debugMode && console.groupEnd();
    this.debugMode && console.timeEnd("⏱️ Preview time");

    // * render TOC page numbers

    this.debugMode && console.time("⏱️ Toc time");
    new Toc({
      config: this.config,
      DOM: DOM,
      selector: this.selector,
      node: node,
      layout: layout,
    }).render();
    this.debugMode && console.timeEnd("⏱️ Toc time");

    // * perform validations

    this.debugMode && console.time("⏱️ Validator time");
    // * Force a layout pass before validation by scrolling and waiting 2 frames
    // * so deferred rendering effects show up in measurements (if not neutralized).
    // *** Adds ~5-25 milliseconds to total processing time.
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, 0);
          resolve();
        });
      });
    });
    new Validator({
      config: this.config,
      DOM: DOM,
      selector: this.selector,
      node: node,
      layout: layout,
      pages: pages,
      previewValidations,
    }).init();
    this.debugMode && console.timeEnd("⏱️ Validator time");

    // * set the attribute that means that rendering is completed successfully
    DOM.setAttribute(layout.root, '[success]');
    DOM.setAttribute(layout.root, '[pages]', pages.length);

    // ? CONDITION
    // ! preloader.remove();

    preloader.remove();

    console.info(`[HTML2PDF4DOC] Page count:`, pages.length);
    console.timeEnd("[HTML2PDF4DOC] Total time");
  }
}
