import * as Logging from '../utils/logging.js';
import * as Selectors from './modules/selectors.js';
import * as SelectorHeuristics from './modules/selectorHeuristics.js';
import * as Stylers from './modules/stylers.js';
import * as Positioning from './modules/positioning.js';
import * as Getters from './modules/getters.js';
import * as Creators from './modules/creators.js';
import * as Splitters from './modules/splitters.js';
import * as Markers from './markers/index.js';
import * as MarkersApi from './markers/api.js';
import * as Wrappers from './modules/wrappers.js';
import * as Fitters from './modules/fitters.js';
import * as PageBreaks from './modules/pagebreaks.js';
import * as Children from './modules/children.js';
import * as Media from './modules/media.js';
import * as Normalizer from './modules/normalizer.js';
import * as Slicers from './modules/slicers.js';
import * as FlowFilters from './modules/flowfilters.js';
import * as Cache from './modules/cache.js';
import * as PaginationRows from './modules/pagination/rows.js';
import * as PaginationFitters from './modules/pagination/fitters.js';
import * as PaginationState from './modules/pagination/state.js';
import * as PaginationKernel from './modules/pagination/kernel.js';
import * as PaginationMetrics from './modules/pagination/metrics.js';
import * as PaginationOverflow from './modules/pagination/overflow.js';
import * as PaginationShortTail from './modules/pagination/shortTail.js';
import * as PaginationEvaluation from './modules/pagination/evaluation.js';
import * as PaginationResolution from './modules/pagination/resolution.js';
import CacheState from './cache/index.js';
import { MarkersState } from './markers/index.js';
import Paragraph from './elements/paragraph.js';
import Table from './elements/table.js';
import TableLike from './elements/tableLike.js';
import Grid from './elements/grid.js';
import Pre from './elements/pre.js';


export default class Node {
  constructor({
    config,
    DOM,
    selector
  }) {
    this._config = config;
    this._DOM = DOM;
    this._selector = selector;
    // * From config:
    this._debug = config.debugMode ? { ...config.debugConfig.node } : {};
    this._assert = config.consoleAssert ? true : false;
    this._markupDebugMode = this._config.markupDebugMode;
    this._markers = new MarkersState({
      debugMode: this._config.debugMode,
      markupDebugMode: this._config.markupDebugMode,
      setAttribute: this._DOM.setAttribute.bind(this._DOM),
      removeAttribute: this._DOM.removeAttribute.bind(this._DOM),
    });
    this._marks = this._markers.marks;
    this._cache = new CacheState();

    Object.assign(this, Logging);

    Object.assign(this, Selectors);
    Object.assign(this, SelectorHeuristics);
    Object.assign(this, Stylers);
    Object.assign(this, Positioning);
    Object.assign(this, Getters);
    Object.assign(this, Creators);
    Object.assign(this, Splitters);
    Object.assign(this, MarkersApi);
    Object.assign(this, Markers);
    Object.assign(this, Wrappers);
    Object.assign(this, Fitters);
    Object.assign(this, PageBreaks);
    Object.assign(this, Children);
    Object.assign(this, Media);
    Object.assign(this, Normalizer);
    Object.assign(this, Slicers);
    Object.assign(this, FlowFilters);
    Object.assign(this, Cache);
    Object.assign(this, PaginationRows);
    Object.assign(this, PaginationFitters);
    Object.assign(this, PaginationState);
    Object.assign(this, PaginationKernel);
    Object.assign(this, PaginationMetrics);
    Object.assign(this, PaginationOverflow);
    Object.assign(this, PaginationShortTail);
    Object.assign(this, PaginationEvaluation);
    Object.assign(this, PaginationResolution);

    this._paragraph = new Paragraph({
      config: this._config,
      DOM: this._DOM,
      selector: this._selector,
      node: this,
    });
    this._pre = new Pre({
      config: this._config,
      DOM: this._DOM,
      selector: this._selector,
      node: this,
    });
    this._table = new Table({
      config: this._config,
      DOM: this._DOM,
      selector: this._selector,
      node: this,
    });
    this._grid = new Grid({
      config: this._config,
      DOM: this._DOM,
      selector: this._selector,
      node: this,
    });
    this._tableLike = new TableLike({
      config: this._config,
      DOM: this._DOM,
      selector: this._selector,
      node: this,
    });
  }

  clearTemplates(root) {
    // Remove all <template>s, if there are any in the Root.
    const templates = this._DOM.getAll('template', root);
    templates.forEach((el) => this._DOM.removeNode(el));
  }

  // **********

  notSolved(element) {
    // TODO !!!
    // помещать такой объект просто на отдельную страницу
    // проверить, если объект больше - как печатаются номера и разрывы
    const tag = this._DOM.getElementTagName(element);
    // return (tag === 'OBJECT')
    return false
  }

}
