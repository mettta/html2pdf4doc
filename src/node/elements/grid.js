import * as Logging from '../../utils/logging.js';
import * as Paginator from './structuredElementPaginator.js';
import * as PartsRecorder from '../modules/parts.recorder.js';
import { createLoopGuard } from '../../utils/loopGuard.js';

const CONSOLE_CSS_END_LABEL = `background:#999;color:#FFF;padding: 0 4px;`;

export default class Grid {
  constructor({
    config,
    DOM,
    node,
    selector,
  }) {
    // * From config:
    this._debug = config.debugMode ? { ...config.debugConfig.grid } : {};
    this._assert = config.consoleAssert ? true : false;
    Object.assign(this, Logging);

    // * Private
    this._DOM = DOM;
    this._selector = selector;
    this._node = node;

    this._resetCurrent();

    // todo
    // 1) move to config
    // Grid:
    this._minBreakableGridRows = 1;
    this._minGridRowContentLines = 2; // minimum lines of content a slice must retain in a tail window
    this._gridCellLineHeightCache = new WeakMap();
    this._gridComputedStyleCache = new WeakMap();

    // TODO make function
    // * From config:
    // - if null is set - the element is not created in createSignpost().
    this._signpostHeight = parseFloat(config.splitLabelHeight) || 0;

  }

  split(gridNode, pageBottom, fullPageHeight, root, computedStyle) {
    this._resetCurrent();

    // Flow outline (parity with simple tables):
    // 1. Collect child grid cells and partition them into visual rows.
    // 2. Measure available space: short first window vs full-page window.
    // 3. Walk rows, registering split indexes when the next row would overflow.
    //    • If the first row itself does not fit → move whole row to next page (🚧 refine logic).
    //    • If rows can be sliced into parts → reuse slicers (🚧 not implemented yet).
    // 4. Build parts by cloning wrappers and moving current rows.
    // 5. Leave original grid as the final slice; no signposts / reclaimed height for now.
    //
    // Long-term grid targets:
    // - support deep slicing of a row's content (mirroring table TD splitting).
    // - fallback for non-breakable items (IMG/SVG) via scaling similar to Table.
    // - guard/skip complex layouts (non-monotonic placement, spans) with explicit logs.

    this._debug._ && console.group('%c split Grid Node', 'background:#00FFFF', gridNode);

    const gridCells = this._node.getPreparedChildren(gridNode);
    this._node.lockNodesWidths(gridCells);

    const nodeComputedStyle = computedStyle ? computedStyle : this._getComputedStyleCached(gridNode);
    // * Use this._node.setInitStyle:
    // * In some layouts grid stays `position: static`; force a relative context so
    // * offset-based getters work (otherwise offsets are taken from body and rows
    // * start looking like a single chunk).

    if (!gridCells.length) {
      this._node.setInitStyle (false, gridNode, nodeComputedStyle);
      this._debug._ && console.groupEnd();
      return [];
    }

    this._node.setInitStyle (true, gridNode, nodeComputedStyle);

    const layoutScan = this._scanGridLayout(gridNode, nodeComputedStyle);
    if (!layoutScan.safe) {
      this._debug._ && console.warn('[grid.split] skip unsafe layout', layoutScan); // { safe:false, reason: … }
      this._debug._ && console.warn('[grid.split] Unsupported grid layout detected; keeping original grid intact.', layoutScan);
      this._node.setInitStyle(false, gridNode, nodeComputedStyle);
      this._debug._ && console.groupEnd();
      return [];
    }

    const ROW_TOP_STEP = 0.5; // tolerate sub-pixel jitter when detecting row breaks
    const currentRows = [];
    let hasRowSpan = false;
    let hasColumnSpan = false;
    const rowIndexSet = new Set();

    // ***** Rely on vertical position only:
    // ***** we support linear, monotonic grids for now.
    // * We track a row’s vertical band (top/bottom) and only start a new row
    // * when a cell falls outside that band;
    // * explicit grid-row-start indices still short-circuit when present.
    let currentRowTrack = null;
    let currentRowTop = null;
    let currentRowBottom = null;

    gridCells.forEach((gridCell) => {
      const cellStyle = this._getComputedStyleCached(gridCell);
      const rowStart = parseInt(cellStyle.gridRowStart, 10);
      const hasRowIndex = Number.isFinite(rowStart);
      const top = this._node.getTop(gridCell, gridNode);
      const bottom = this._node.getBottom(gridCell, gridNode);

      let startNewRow = false;

      if (!currentRows.length) {
        // 🤖 first cell always seeds the row bucket
        startNewRow = true;
      } else if (hasRowIndex && currentRowTrack != null) {
        // 🤖 when CSS explicitly names grid row tracks, rely on that index
        startNewRow = rowStart !== currentRowTrack;
      } else if (currentRowBottom != null) {
        // 🤖 fallback: treat the row as a vertical band;
        //    if the next cell sits below the band, start a new row
        startNewRow = top >= (currentRowBottom - ROW_TOP_STEP);
      } else if (currentRowTop != null) {
        startNewRow = Math.abs(top - currentRowTop) > ROW_TOP_STEP;
      } else {
        startNewRow = true;
      }

      if (startNewRow) {
        currentRows.push([gridCell]);
        currentRowTrack = hasRowIndex ? rowStart : null;
        currentRowTop = top;
        currentRowBottom = bottom;
      } else {
        currentRows[currentRows.length - 1].push(gridCell);
        if (hasRowIndex && currentRowTrack == null) {
          currentRowTrack = rowStart;
        }
        if (currentRowTop == null || top < currentRowTop) {
          currentRowTop = top;
        }
        if (currentRowBottom == null || bottom > currentRowBottom) {
          currentRowBottom = bottom;
        }
      }

      // ** Detect spans and collect row-start indices.
      // ** If row-starts jump beyond known current rows (implicit tracks/gaps),
      // ** or any cell spans rows/columns, skip splitting this grid.
      const rowEnd = cellStyle.gridRowEnd || '';
      const colEnd = cellStyle.gridColumnEnd || '';
      hasRowSpan = hasRowSpan || rowEnd.includes('span');
      hasColumnSpan = hasColumnSpan || colEnd.includes('span');

      hasRowIndex && rowIndexSet.add(rowStart);
      // todo: span w/o 'span' keyword
      // todo: gridRowEnd/gridColumnEnd as Num/-1
      // todo: gridRowStart asNaN (named lines)
      // todo: improve "implicit row gaps"?
      // - misses within a set of starts:
      // - for example, if rowIndexSet contains {1,3,5}, and 2 and 4 are missing?
    });

    const hasImplicitRowGaps = rowIndexSet.size > 0 && Math.max(...rowIndexSet) > currentRows.length;
    if (hasImplicitRowGaps) {
      this._debug._ && console.warn('[grid.split]', 'Unsupported implicit row gap detected; keeping grid unsplit.', { hasImplicitRowGaps });
      this._node.setInitStyle(false, gridNode, nodeComputedStyle);
      this._debug._ && console.groupEnd();
      return [];
    }

    if (hasRowSpan || hasColumnSpan) {
      this._debug._ && console.warn('[grid.split]', 'Grid contains row/column spans; using fallback (move row to next page).', { hasRowSpan, hasColumnSpan });
      this._debug._ && console.groupEnd();
      return this._fallbackMoveGridToNextPage({ gridNode, nodeComputedStyle });
    }

    this.log('grid.split', 'currentRows:', currentRows)

    // ** Prepare gridNode parameters for splitting
    const nodeTop = this._node.getTop(gridNode, root);
    const nodeWrapperHeight = this._node.getEmptyNodeHeightByProbe(gridNode);
    const firstPartHeight = pageBottom
      - nodeTop
      // - this._signpostHeight
      - nodeWrapperHeight;
    const fullPagePartHeight = fullPageHeight
      // - 2 * this._signpostHeight
      - nodeWrapperHeight;

    this.log('grid.split', {firstPartHeight, fullPagePartHeight});

    //? #grid_refactor
    //  captures the active grid node, current rows, and full-page metrics
    //  in instance fields, letting the adapter feed consistent data
    //  into the shared paginator log, share currentRows through a single entries container,
    //  and collect the parts we build for downstream analysis/debugging.
    this._currentGridNode = gridNode;
    this._currentGridRows = currentRows;
    this._currentGridFullPartHeight = fullPagePartHeight;
    this._currentGridSplitLog = [];
    this._currentGridEntries = PartsRecorder.createEntries({ owner: gridNode, currentRows });
    this._currentGridRecordedParts = this._currentGridEntries;
    this._currentGridNode.__html2pdf4docRecordedParts = this._currentGridRecordedParts; // Expose for DevTools and external diagnostics
    this._currentGridShellCache = new WeakMap();

    // ** If there are enough rows for the split to be readable,
    // ** and the gridNode is not too big (because of the content),
    // ** then we will split it.
    if (
      currentRows.length < this._minBreakableGridRows
      && this._DOM.getElementOffsetHeight(gridNode) < fullPageHeight
    ) {
      this._node.setInitStyle(false, gridNode, nodeComputedStyle);
      this._resetCurrent();
      this.logGroupEnd(`%c END [grid.split]: DON'T SPLIT, it isn't breakable and fits in the page`);
      return []
    }

    // === Pagination across rows ===
    //? #grid_refactor
    //  replaces bespoke split-bottom math with updateSplitBottom/registerPageStartAt,
    //  so page windows and split indexes are maintained by the same helpers Table uses.

    const splitStartRowIndexes = [];
    const entries = this._currentGridEntries;
    //  *** #tempLoopGuard
    //  loopGuardLimit is just a safety cap: the while-loop should process each grid row
    //  a handful of times (tail window, full-page attempt, scaling).
    //  Even in the worst case we don’t expect to revisit any row more than a few passes,
    //  so we multiply the row count by 6 to give enough slack.
    //  If the loop ever exceeds that budget, something is wrong and the guard
    //  fires an assertion instead of spinning forever.
    //  The budget follows the current row count: slicing a tall row replaces it
    //  with its slices in currentRows, and the loop then visits every slice.
    //  A single row that spans many pages becomes many rows.
    const tickLoopGuard = createLoopGuard({
      label: 'grid.split',
      limit: () => Math.max(1, (currentRows.length || 1) * 6),
      assert: this._assert,
    });

    this._updateCurrentGridSplitBottom(firstPartHeight, 'start with initial window');

    for (let rowIndex = 0; rowIndex < currentRows.length; rowIndex += 1) {
      tickLoopGuard();

      // 🤖 Stage 5 — build row evaluation shared with Table; includes cached cell styles for reuse in split helpers.

      const evaluation = this._buildGridRowEvaluation({
        rows: currentRows,
        rowIndex,
        gridNode,
        splitBottom: this._currentGridSplitBottom,
      });

      if (!evaluation?.row) {
        this._debug._ && console.warn('[grid.split] Missing row during evaluation; keeping grid unsplit at this row.', { rowIndex });
        continue;
      }

      if (evaluation.rowBottom <= this._currentGridSplitBottom) {
        this.log('grid.split', 'Row fits current window', { rowIndex, splitBottom: this._currentGridSplitBottom });
        continue;
      }

      const updatedIndex = this._resolveGridOverflowingRow({ evaluation, splitStartRowIndexes });
      // 🤖 If Stage 5 fails to produce slices (needsScalingInFullPage), _forwardGridOverflowFallback handles full-page scaling before we retry the row.
      if (updatedIndex < rowIndex) {
        rowIndex = Math.max(updatedIndex, -1);
      }
    }

    const finalStartId = splitStartRowIndexes.length ? splitStartRowIndexes.at(-1) : 0;
    // For telemetry: finalStartId mirrors table slices even though final build does not need it
    const sliceResults = splitStartRowIndexes
      .map((value, index, array) => this._buildGridSplit({
        startId: array[index - 1] || 0,
        endId: value,
        node: gridNode,
        entries,
      }))
      .filter(Boolean);

    const splits = [
      ...sliceResults.map(result => result.part),
      this._createAndInsertGridFinalSlice({ node: gridNode, entries, startId: finalStartId }),
    ];

    this.log('grid.split', {
      splitStartRowIndexes,
      splits,
      'recordedParts': this._currentGridRecordedParts?.parts
    });

    this._node.setInitStyle(false, gridNode, nodeComputedStyle);
    this._resetCurrent();
    this.logGroupEnd('split Grid Node');
    return splits;
  }

  _fallbackMoveGridToNextPage({ gridNode, nodeComputedStyle }) {
    // 🤖 Span-heavy or otherwise unsupported layout: keep the grid intact and reset state.
    this._node.setInitStyle(false, gridNode, nodeComputedStyle);
    this._resetCurrent();
    return [];
  }

  _resetCurrent() {
    this._currentGridNode = undefined;
    this._currentGridRows = undefined;
    this._currentGridEntries = undefined;
    this._currentGridRecordedParts = undefined;
    this._currentGridSplitBottom = undefined;
    this._currentGridFullPartHeight = undefined;
    this._currentGridSplitLog = undefined;
    this._currentGridRowFlags = undefined;
    this._currentGridShellCache = undefined;
    this._gridCellLineHeightCache = new WeakMap();
    this._gridComputedStyleCache = new WeakMap();
  }

  _getGridSplittableHandlers({ evaluation, splitStartRowIndexes }) {
    return {
      getRowSliceAdapter: ({ row }) => this._createGridRowSliceAdapter({ row, rowIndex: evaluation.rowIndex }),
      onReplaceRow: ({ newRows }) => {
        this._removeOriginalGridRowCells(evaluation.row);
        this._node.paginationRefreshRowsAfterSplit(this._getSplitterAdapter(), {
          rowIndex: evaluation.rowIndex,
          rowSlices: newRows,
        });
      },
      onAbsorbTail: () => {},
      onRefreshRows: ({ newRows }) => {
        this._node.paginationRefreshRowsAfterSplit(this._getSplitterAdapter(), {
          rowIndex: evaluation.rowIndex,
          rowSlices: newRows,
        });
      },
      onPlacement: ({ evaluation, newRows, insufficientRemainingWindow, isFirstPartEmptyInAnyTD, needsScalingInFullPage }) => (
        this._node.paginationHandleRowSlicesPlacement({
          evaluation,
          table: this._currentGridNode,
          newRows,
          insufficientRemainingWindow,
          isFirstPartEmptyInAnyTD,
          needsScalingInFullPage,
          splitStartRowIndexes,
          pageBottom: this._currentGridSplitBottom,
          fullPageHeight: this._currentGridFullPartHeight,
          debug: this._debug,
          resolveRowBounds: (row) => this._getRowBounds(row, this._currentGridNode),
          registerPageStartCallback: ({ targetIndex, reason }) => this._registerPageStartAt(targetIndex, splitStartRowIndexes, reason),
          scaleProblematicSliceCallback: (slice, targetHeight) => this._scaleGridCellsToHeight(slice, targetHeight),
          applyFullPageScalingCallback: ({ row: slice, needsScalingInFullPage: needsScaling, fullPageHeight }) => {
            this._node.paginationApplyFullPageScaling({
              needsScalingInFullPage: needsScaling && Boolean(slice),
              payload: {
                cells: slice,
                targetHeight: fullPageHeight,
              },
              scaleCallback: ({ cells, targetHeight }) => this._scaleGridCellsToHeight(cells, targetHeight),
            });
          },
        })
      ),
      onSplitFailure: ({ evaluation, splitStartRowIndexes: indexes, availableRowHeight, fullPageHeight }) => (
        this._forwardGridOverflowFallback({
          evaluation,
          splitStartRowIndexes: indexes,
          availableRowHeight,
          fullPageHeight,
          branch: 'splitFailure',
        })
      ),
    };
  }

  _forwardGridOverflowFallback({ evaluation, splitStartRowIndexes, availableRowHeight, fullPageHeight = this._currentGridFullPartHeight, branch, reasonTail, reasonFull }) {
    const helpers = this._composeGridOverflowHelpers();
    const payload = {
      ownerLabel: `grid:${branch}` ,
      gridNode: this._currentGridNode,
      evaluation,
      rowIndex: evaluation.rowIndex,
      row: evaluation.row,
      availableRowHeight,
      fullPageHeight,
      splitStartRowIndexes,
      reasonTail: reasonTail || (branch === 'splitFailure' ? 'Grid split failed — move row to next page' : 'Grid slice overflow — move row to next page'),
      reasonFull: reasonFull || (branch === 'splitFailure' ? 'Grid split failed — scaled cells to full page' : 'Grid slice overflow — scaled cells to full page'),
      registerPageStartCallback: helpers.registerPageStartCallback,
      scaleProblematicCellsCallback: helpers.scaleProblematicCellsCallback,
      debugLogger: helpers.debugLogger,
    };

    this._debug._ && console.log('[grid.overflow]', branch, payload);

    if (branch === 'splitFailure') {
      return this._node.handleRowSplitFailure(payload);
    // 🤖 Shared helper scales problematic cells via scaleProblematicCellsCallback before re-evaluating the row on a full page.
    }
    return this._node.handleRowOverflow(payload);
  }

  _buildGridRowEvaluation({ rows, rowIndex, gridNode, splitBottom }) {
    if (!Array.isArray(rows)) {
      return null;
    }
    const row = rows[rowIndex];
    if (!row) {
      return null;
    }
    const cellStyles = Array.isArray(row) ? new Array(row.length) : null;
    const { top: rowTop, bottom: rowBottom } = this._getRowBounds(row, gridNode);
    const nextRow = rows[rowIndex + 1];
    const nextMarker = nextRow ? this._getRowTop(nextRow, gridNode) : rowBottom;
    const delta = nextMarker - splitBottom;
    const tailWindowHeight = splitBottom - rowTop;
    return {
      rowIndex,
      row,
      rowTop,
      rowBottom,
      nextMarker,
      delta,
      tailWindowHeight,
      isLastRow: !nextRow,
      fitsCurrentWindow: delta <= 0,
      cellStyles,
    };
  }


  _composeGridOverflowHelpers() {
    const registerPageStartCallback = this._registerPageStartAt.bind(this);
    // const scaleCellsToHeightCallback = this._scaleGridCellsToHeight.bind(this);
    const debugLogger = this._debug && this._debug._
      ? (message, payload) => console.log(message, payload)
      : undefined;

    return {
      registerPageStartCallback,
      scaleProblematicCellsCallback: (row, targetHeight) => {
        if (!Array.isArray(row)) return false;
        return this._scaleGridCellsToHeight(row, targetHeight);
      // 🤖 Mirrors Table's scaleProblematicCellsCallback: shrink only overflowing cells so the row fits the window.
      },
      debugLogger,
    };
  }



  _resolveGridOverflowingRow({ evaluation, splitStartRowIndexes }) {
    return this._node.paginationResolveOverflowingRow({
      evaluation,
      utils: {
        rowHasSpan: () => false,
        isSlice: (row) => this._isGridRowSlice(row),
      },
      handlers: {
        handleRowWithRowspan: () => {
          this._debug._ && console.warn('[grid.split] ROWSPAN guard triggered unexpectedly.', { evaluation });
          this._registerPageStartAt(evaluation.rowIndex, splitStartRowIndexes, 'Grid ROWSPAN fallback — move row to next page');
          return evaluation.rowIndex - 1;
        },
        handleSplittableRow: () => this._resolveGridSplittableRow({ evaluation, splitStartRowIndexes }),
        handleAlreadySlicedRow: () => this._forwardGridOverflowFallback({
          evaluation,
          splitStartRowIndexes,
          branch: 'alreadySliced',
        }),
      },
    });
  }

  _resolveGridSplittableRow({ evaluation, splitStartRowIndexes }) {
    const { rowIndex } = evaluation;

    this._debug._ && console.group('%c[grid.split] Stage5 — splittable row', 'color:#0080ff', {
      rowIndex,
      row: evaluation.row,
      tailWindowHeight: evaluation.tailWindowHeight,
    });

    const minMeaningfulRowSpace = this._estimateGridRowMeaningfulSpace({
      row: evaluation.row,
      cellStyles: evaluation.cellStyles,
      minContentLines: this._minGridRowContentLines,
    });

    if (!(minMeaningfulRowSpace > 0)) {
      console.warn('[grid.metrics] Meaningful row space is unavailable; falling back to overflow handler.');
      return this._forwardGridOverflowFallback({
        evaluation,
        splitStartRowIndexes,
        availableRowHeight: evaluation.tailWindowHeight,
        fullPageHeight: this._currentGridFullPartHeight,
        branch: 'metricsMissing',
        reasonTail: 'Grid row metrics missing — move row to next page',
        reasonFull: 'Grid row metrics missing — scaled cells to full page',
      });
    }

    const budget = this._node.paginationCalculateRowSplitBudget({
      tailWindowHeight: evaluation.tailWindowHeight,
      minMeaningfulRowSpace,
      fullPartHeight: this._currentGridFullPartHeight,
      debug: this._debug,
    });

    const splitResult = this._node.paginationSplitRow({
      rowIndex,
      row: evaluation.row,
      firstPartHeight: budget.firstPartHeight,
      fullPageHeight: this._currentGridFullPartHeight,
      debug: this._debug,
      decorateRowSlice: ({ rowWrapper, rowIndex: sourceRowIndex, sliceIndex }) => {
        if (rowWrapper instanceof HTMLElement) {
          this._DOM.setAttribute(rowWrapper, `.grid_row_${sourceRowIndex}_part_${sliceIndex}`);
        }
      },
      rowAdapter: this._createGridRowSliceAdapter({ row: evaluation.row, rowIndex, cellStyles: evaluation.cellStyles }),
    });

    const updatedIndex = this._node.paginationProcessRowSplitResult({
      evaluation,
      splitResult,
      splitStartRowIndexes,
      insufficientRemainingWindow: budget.insufficientRemainingWindow,
      extraCapacity: 0,
      fullPageHeight: this._currentGridFullPartHeight,
      debug: this._debug,
      handlers: this._getGridSplittableHandlers({ evaluation, splitStartRowIndexes }),
    });

    this.logGroupEnd('[grid.split] Stage5 — splittable row');
    return updatedIndex;
  }

  _createGridRowSliceAdapter({ row, rowIndex, cellStyles }) {
    if (!Array.isArray(row)) {
      return null;
    }

    const gridNode = this._currentGridNode;
    const anchor = row[0] || null;
    const self = this;

    return {
      getParentContainer: () => gridNode,
      getOriginalCells: () => [...row],
      getShellHeights: () => self._getGridShellHeights(row, cellStyles),
      markOriginalRow: ({ cells }) => {
        cells.forEach(cell => self._node.markSlice(cell));
      },
      beginRow: () => ({ fragment: self._DOM.createDocumentFragment(), cells: [] }),
      cloneCellFallback: (originalCell) => self._DOM.cloneNodeWrapper(originalCell),
      handleCell: ({ context, cellClone }) => {
        self._node.markSlice(cellClone);
        context.fragment.append(cellClone);
        context.cells.push(cellClone);
      },
      finalizeRow: ({ context }) => {
        if (anchor) {
          self._DOM.insertBefore(anchor, context.fragment);
        }
        return context.cells;
      },
    };
  }

  _removeOriginalGridRowCells(row) {
    if (!Array.isArray(row)) {
      return;
    }
    row.forEach(cell => {
      if (cell instanceof HTMLElement) {
        this._DOM.removeNode(cell);
      }
    });
  }

  _isGridRowSlice(row) {
    if (Array.isArray(row)) {
      const cell = row.find(candidate => candidate instanceof HTMLElement);
      return cell ? this._node.isSlice(cell) : false;
    }
    return row ? this._node.isSlice(row) : false;
  }

  _getPaginatorAdapter() {
    return {
      label: 'grid',
      getSplitBottom: () => this._currentGridSplitBottom,
      setSplitBottom: (value) => { this._currentGridSplitBottom = value; },
      computeSplitBottomForElement: (element) => {
        if (!element || !this._currentGridNode) {
          return this._currentGridSplitBottom || 0;
        }
        return this._node.getTop(element, this._currentGridNode) + (this._currentGridFullPartHeight || 0);
      },
      getRows: () => {
        if (!Array.isArray(this._currentGridRows)) {
          return [];
        }
        return this._currentGridRows.map((group) => {
          if (!group) {
            return null;
          }
          if (group instanceof HTMLElement) {
            return group;
          }
          if (Array.isArray(group)) {
            const cell = group.find((candidate) => candidate instanceof HTMLElement);
            if (cell) {
              return cell;
            }
            const top = this._getRowTop(group, this._currentGridNode);
            return Number.isFinite(top) ? top : null;
          }
          const top = this._getRowTop(group, this._currentGridNode);
          return Number.isFinite(top) ? top : null;
        });
      },
      shouldAssert: () => this._assert,
      getDebug: () => this._debug,
      getSplitBottomLog: () => this._currentGridSplitLog,
    };
  }

  _getSplitterAdapter() {
    return {
      label: 'grid',
      rows: {
        getCurrentRows: () => this._currentGridRows || [],
        replaceRow: ({ rowIndex, rowSlices }) => {
          if (!Array.isArray(this._currentGridRows)) return;
          this._node.replaceCurrentRowsAfterRowSplit({
            currentRows: this._currentGridRows,
            index: rowIndex,
            rowSlices,
          });
        },
        syncEntries: () => {
          if (this._currentGridEntries) {
            this._currentGridEntries.currentRows = this._currentGridRows;
          }
          if (this._currentGridRecordedParts) {
            this._currentGridRecordedParts.currentRows = this._currentGridRows;
          }
        },
        getGuardConfig: () => ({
          rows: this._currentGridRows || [],
          DOM: this._DOM,
        }),
      },
      guards: {
        onFlags: ({ flags }) => {
          this._currentGridRowFlags = flags;
        },
      },
    };
  }

  _updateCurrentGridSplitBottom(elementOrValue, message = 'unknown case') {
    Paginator.updateSplitBottom(this._getPaginatorAdapter(), elementOrValue, message);
  }

  _registerPageStartAt(index, splitStartRowIndexes, reason = 'register page start') {
    Paginator.registerPageStartAt(this._getPaginatorAdapter(), index, splitStartRowIndexes, reason);
  }

  _scaleGridCellsToHeight(cells, targetHeight) {
    if (!Array.isArray(cells) || !cells.length || !(targetHeight > 0)) {
      return false;
    }
    const shells = this._getGridShellHeights(cells); // 🤖 reuse cached shell heights when possible
    // In debug builds log the cell heights before/after scaling so we can confirm
    // geometry changed; otherwise silent overflow is hard to diagnose.
    const beforeHeights = this._debug._ ? cells.map(cell => this._DOM.getElementOffsetHeight(cell)) : null;
    const scaled = this._node.paginationScaleCellsToHeight({ cells, targetHeight, shells });
    if (this._debug._) {
      const afterHeights = cells.map(cell => this._DOM.getElementOffsetHeight(cell));
      console.log('[grid.scaleCells] target:', targetHeight, 'shells:', shells, 'before:', beforeHeights, 'after:', afterHeights, 'scaled:', scaled);
    }
    return scaled;
  }

  _buildGridSplit({ startId, endId, node, entries }) {
    const currentRows = entries?.currentRows || this._currentGridRows || [];
    if (startId === endId) {
      // Empty slice means pagination markers collided; log and assert in dev.
      this._debug._ && console.warn('[grid.split] _buildGridSplit: skip empty slice request', startId, endId);
      this.strictAssert(false, '[grid.split] _buildGridSplit: empty slice encountered');
      return null;
    }
    if (this._debug._) {
      const rowsPreview = currentRows.slice(startId, endId);
      console.log(`=> [grid.split] _buildGridSplit: slice rows [${startId}, ${endId})`, rowsPreview);
    }
    const part = this._createAndInsertGridSlice({ startId, endId, node, entries });
    const telemetryRows = this._collectGridTelemetryRows(currentRows, startId, endId);
    this._recordGridPart(part, {
      startId,
      endId,
      type: 'slice',
      rows: telemetryRows,
    });
    return { part, telemetryRows };
  }

  _createAndInsertGridSlice({ startId, endId, node, entries }) {
    // We do not wrap with createWithFlagNoBreak to avoid CSS breakage; clone wrapper instead.
    const part = this._DOM.cloneNodeWrapper(node);
    this._node.copyNodeWidth(part, node);
    this._node.markNoBreak(part);

    if (startId) {
      // * normalize top cut for table slices
      // ? may affect the table design
      // todo: include in user config
      this._node.markTopCut(part);
    }
    // * normalize bottom cut for table slices
    this._node.markBottomCut(part);


    node.before(part);

    const currentRows = entries?.currentRows || fallbackCurrentRows || [];
    // currentRows arrive via the shared entries container; fallback keeps older callers working.

    // Allow the DOM module to tell us what counts as an element.
    // Grid adapters sit between plain HTMLElements and wrappers returned by getPreparedChildren,
    // and test/SSR environments may not expose global HTMLElement reliably.
    const isElementNodeFn = (this && this._DOM && typeof this._DOM.isElementNode === 'function')
      ? this._DOM.isElementNode.bind(this._DOM)
      : null;

    const partEntries = currentRows
      .slice(startId, endId)
      .flat()
      .map(candidate => {
        if (!candidate) return null;
        if (isElementNodeFn && isElementNodeFn(candidate)) {
          return candidate;
        }
        if (typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement) {
          return candidate;
        }
        const element = candidate.element;
        if (element) {
          if (isElementNodeFn && isElementNodeFn(element)) {
            return element;
          }
          if (typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) {
            return element;
          }
        }
        // Returning null lets .filter(Boolean) drop non-element placeholders quietly;
        // getPreparedChildren may emit helper descriptors that are not renderable nodes.
        return null;
      })
      .filter(Boolean);

    this._DOM.insertAtEnd(part, ...partEntries);
    return part;
  }

  _createAndInsertGridFinalSlice({ node, entries, startId }) {
    const finalPart = node;

    // * Final slice is the original node (flagged no-break) left in place.
    // * normalize top cut for table slices
    // ? may affect the table design
    // todo: include in user config
    this._node.markTopCut(finalPart);
    this._node.markNoBreak(finalPart);

    const currentRows = entries?.currentRows || this._currentGridRows || [];
    const telemetryRows = this._collectGridTelemetryRows(currentRows, startId);
    this._recordGridPart(finalPart, {
      startId,
      endId: currentRows.length,
      type: 'final',
      rows: telemetryRows,
    });
    return finalPart;
  }

  // TODO(grid/table): evaluate moving telemetry collection into a shared helper (see docs/_Grid_Table_Refactor_Roadmap.md).
  _collectGridTelemetryRows(currentRows, startId, endId) {
    if (!Array.isArray(currentRows)) {
      return [];
    }
    const slice = currentRows.slice(startId, typeof endId === 'number' ? endId : undefined);
    return slice.map((row, offset) => {
      const cells = Array.isArray(row) ? [...row] : [row];
      return {
        rowIndex: startId + offset,
        row,
        cells,
      };
    });
  }

  _recordGridPart(part, meta = {}) {
    const entries = this._currentGridRecordedParts;
    if (!entries || !part) {
      return null;
    }
    const {
      startId = null,
      endId = null,
      type = 'unknown',
      rows = [],
      meta: extraMeta,
    } = meta || {};
    return PartsRecorder.recordPart({
      entries,
      part,
      startIndex: startId,
      endIndex: endId,
      type,
      rows,
      meta: extraMeta,
    });
  }

  // 🤖 Estimate how much vertical space (in px) the row needs to host the minimum meaningful amount of content before splitting.
  _estimateGridRowMeaningfulSpace({ row, cellStyles = null, minContentLines = this._minGridRowContentLines }) {
    if (!Array.isArray(row) || row.length === 0) {
      console.warn('[grid.metrics] Row payload missing while estimating split budget.');
      return null;
    }

    const shells = this._getGridShellHeights(row, cellStyles);
    const styles = Array.isArray(cellStyles) ? cellStyles : null;
    const fallbackLines = Math.max(1, minContentLines);
    let maxCellBudget = 0;

    row.forEach((cell, index) => {
      if (!(cell instanceof HTMLElement)) {
        console.warn('[grid.metrics] Unexpected non-element cell in row; ignoring during split budget calculation.', { cell, index });
        return;
      }

      let style = styles ? styles[index] : null;
      if (!style) {
        style = this._getComputedStyleCached(cell);
        if (styles) {
          styles[index] = style;
        }
      }

      const lineHeight = this._resolveGridCellLineHeight({ cell, style });
      const structuralShell = shells?.[index] || 0;
      const cellBudget = structuralShell + lineHeight * fallbackLines;
      maxCellBudget = Math.max(maxCellBudget, cellBudget);
    });

    if (!(maxCellBudget > 0)) {
      console.warn('[grid.metrics] Failed to measure meaningful row space.');
      return null;
    }

    return maxCellBudget;
  }

  // 🤖 Resolve the effective line-height for a grid cell, falling back to measured values when CSS omits explicit numbers.
  _resolveGridCellLineHeight({ cell, style }) {
    // * use cached value, if available
    const cache = this._gridCellLineHeightCache;
    const cached = cache?.get(cell);
    if (cached > 0) {
      return cached;
    }

    // * style must be passed
    if (!style) {
      console.warn('[grid.metrics] style not passed for _resolveGridCellLineHeight', { cell });
      style = this._getComputedStyleCached(cell);
    }

    // * check in style
    let numeric = parseFloat(style?.lineHeight);
    if (numeric > 0) {
      cache?.set(cell, numeric);
      return numeric;
    }

    // * check in style fontSize & approximate
    const fontSize = parseFloat(style?.fontSize);
    if (Number.isFinite(fontSize) && fontSize > 0) {
      const derived = fontSize * 1.2;
      cache?.set(cell, derived);
      return derived;
    }

    // * perform calculations (DOM mutation)
    numeric = this._node.getLineHeight(cell);
    if (numeric > 0) {
      cache?.set(cell, numeric);
      return numeric;
    }

    // * We are unlikely to get here after calculations via Probe.
    // * But if that happens, let's cache a frequently occurring value
    // * for the failed cell, and return it.
    const DEFAULT_BASELINE = 16;
    cache?.set(cell, DEFAULT_BASELINE);
    return DEFAULT_BASELINE;
  }

  _getGridShellHeights(row, cellStyles = null) {
    if (!this._currentGridShellCache) {
      this._currentGridShellCache = new WeakMap();
    }
    if (this._currentGridShellCache.has(row)) {
      return this._currentGridShellCache.get(row);
    }
    const targetCells = Array.isArray(row) ? row : [row].filter(Boolean);
    const shells = this._computeGridCellShellHeights(targetCells, cellStyles);
    this._currentGridShellCache.set(row, shells);
    return shells;
  }

  // 🤖 Cache computed styles per cell during a split run to avoid repeated layout reads across helpers.
  _getComputedStyleCached(element) {
    if (!element) {
      console.warn('[grid.split] the element was not passed to _getComputedStyleCached');
      return null;
    }
    const cache = this._gridComputedStyleCache;
    if (!cache) {
      return this._DOM.getComputedStyle(element);
    }
    const cached = cache.get(element);
    if (cached) {
      return cached;
    }
    const style = this._DOM.getComputedStyle(element);
    cache.set(element, style);
    return style;
  }


  _computeGridCellShellHeights(cells, styles = null) {
    // Grid rows do not wrap cells in TR shells; estimate each cell's structural contribution
    // so slicers operate on content height only. Reuse cached computedStyle via WeakMap to avoid
    // repeated layout reads when traversing the same row multiple times.
    if (!Array.isArray(cells) || !cells.length) {
      return [];
    }
    return cells.map((cell, index) => {
      if (!cell) return 0;
      let style = null;
      if (styles) {
        // 🤖 reuse entry-level cache when helper array provides slots
        style = styles[index];
        if (!style) {
          style = this._getComputedStyleCached(cell);
          styles[index] = style;
        }
      } else {
        style = this._getComputedStyleCached(cell);
      }
      const paddingTop = parseFloat(style?.paddingTop) || 0;
      const paddingBottom = parseFloat(style?.paddingBottom) || 0;
      const borderTop = parseFloat(style?.borderTopWidth) || 0;
      const borderBottom = parseFloat(style?.borderBottomWidth) || 0;
      const marginTop = parseFloat(style?.marginTop) || 0;
      const marginBottom = parseFloat(style?.marginBottom) || 0;
      const paddingBorder = paddingTop + paddingBottom + borderTop + borderBottom;
      // 🤖 margins treated as shell contribution so leftover height stays accurate
      const margin = Math.max(0, marginTop) + Math.max(0, marginBottom);

      // Avoid probe-based content measurements in grids: stretched rows make probes misleading.
      // Shell here is strictly padding+border, with margins added separately.
      const shell = Math.max(0, paddingBorder);
      // 🤖 Align with Table: ensure shell always covers padding/border + margin so slicing budgets remain conservative.
      return Math.max(0, shell + margin);
    });
  }

  _getRowBounds(row, gridNode, want = 'both') {
    // Delegate to shared helper so grid/table share one implementation.
    return this._node.resolveRowBoundsGeneric(row, gridNode, want);
  }

  _getRowTop(row, gridNode) {
    return this._getRowBounds(row, gridNode, 'top').top;
  }

  _getRowBottom(row, gridNode) {
    return this._getRowBounds(row, gridNode, 'bottom').bottom;
  }

  _scanGridLayout(_node, nodeComputedStyle) {
    const autoFlow = nodeComputedStyle.gridAutoFlow || '';
    if (!autoFlow.startsWith('row')) {
      return { safe: false, reason: `grid-auto-flow=${autoFlow}` };
    }
    if (autoFlow.includes('dense')) {
      // TODO(grid): support dense flow by re-evaluating row ordering.
      return { safe: false, reason: 'grid-auto-flow dense not supported yet' };
    }

    const templateAreas = nodeComputedStyle.gridTemplateAreas || 'none';
    if (templateAreas !== 'none') {
      return { safe: false, reason: 'grid-template-areas present' };
    }

    const templateColumns = nodeComputedStyle.gridTemplateColumns || '';
    const templateRows = nodeComputedStyle.gridTemplateRows || '';
    const complexTemplate = (value) => (
      value.includes('subgrid') ||
      value.includes('auto-fit') ||
      value.includes('auto-fill') ||
      value.includes('fit-content')
    );
    if (complexTemplate(templateColumns) || complexTemplate(templateRows)) {
      return { safe: false, reason: 'complex track sizing (subgrid/auto-fit/fit-content)' };
    }

    const hasNamedLines = /\[.*?\]/.test(templateColumns) || /\[.*?\]/.test(templateRows);
    if (hasNamedLines) {
      // TODO(grid): replicate named lines per slice once templates are copied over.
      return { safe: false, reason: 'named grid lines detected' };
    }

    return { safe: true };
  }

}
