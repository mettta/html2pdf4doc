import * as Logging from '../../utils/logging.js';

// SEE splitTextByWordsGreedyWithSpacesFilter(node) in DOM
const WORD_JOINER = '';

export default class Paragraph {
  constructor({
    config,
    DOM,
    node,
    selector,
  }) {
    // * From config:
    this._debug = config.debugMode ? { ...config.debugConfig.paragraph } : {};
    this._assert = config.consoleAssert ? true : false;
    // * Private
    this._DOM = DOM;
    this._selector = selector;
    this._node = node;


    // todo
    // 1) move to config
    // Paragraph:
    this._minParagraphLeftLines = 2;
    this._minParagraphDanglingLines = 2;

    // calculate
    this._minParagraphBreakableLines = this._minParagraphLeftLines + this._minParagraphDanglingLines || 2;

    Object.assign(this, Logging);
  }

  split(node) {
    return this._splitComplexTextBlockIntoLines(node)
  }

  _estimateLineCount(element) {
    return Math.ceil(this._DOM.getElementOffsetHeight(element) / this._node.getLineHeight(element))
  }

  _splitComplexTextBlockIntoLines(node) {

    // TODO "complexTextBlock"

    this._debug._ && console.group('_splitComplexTextBlockIntoLines', [node]);

    if (this._estimateLineCount(node) < this._minParagraphBreakableLines) {

      this.logGroupEnd('few lines - Not to break it up');
      // Not to break it up
      return []
    }

    if (this._node.hasMark(node, 'split')) {
      // * This node has already been processed and has lines and groups of lines inside it,

      this.logGroupEnd(this._selector.split);
      // * so we just return those child elements:
      return this._DOM.getChildren(node);
    }

    const nodeChildren = this._node.getPreparedChildren(node);
    const extendedChildrenArray = nodeChildren.map(
      element => {
        const lineHeight = this._node.getLineHeight(element);
        const height = this._DOM.getElementOffsetHeight(element);
        const left = this._DOM.getElementOffsetLeft(element);
        const top = this._DOM.getElementOffsetTop(element);
        //// const lines = ~~(height / lineHeight);
        // * We round up to account for inline elements
        // * whose height is less than the sum of line heights.
        const lines = Math.ceil(height / lineHeight);
        const text = this._DOM.getInnerHTML(element);

        return {
          element,
          lines,
          left,
          top,
          height,
          lineHeight,
          text
        }
      }
    );
    this._debug._ && console.log(
      '\n🚸 nodeChildren',[...nodeChildren],
      '\n🚸 extendedChildrenArray',[...extendedChildrenArray]
    );

    // !!!
    // ? break it all down into lines

    // * Process the children of the block:
    const partiallyLinedChildren = extendedChildrenArray.flatMap((item) => {
      // * Break it down as needed:
      if ((item.lines > 1) && !this._node.isNotBreakable(item.element)) {
        return this._breakItIntoLines(item.element); // array
      }
      // * otherwise keep the original element:
      return item.element;
    });
    this._debug._ && console.log('\n🚸🚸🚸\n partiallyLinedChildren',[...partiallyLinedChildren]);

    // * Prepare an array of arrays containing references to elements
    // * that fit into the same row:
    const groupedPartiallyLinedChildren = partiallyLinedChildren.reduce(
      (result, currentElement, currentIndex, array) => {

        // * If this is the very beginning, we start a new line:
        if (!result.length) {
          result = [[currentElement]];
          this._debug._ && console.log('%c➡️ ◼️ start the first line:', 'font-weight: bold; color: yellow; background-color: #808080;', currentElement);
          return result;
        }

        const currentLine = result.at(-1);

        // * If BR is encountered, we start a new empty line:
        if(this._DOM.getElementTagName(currentElement) === 'BR' ) {
          currentLine.push(currentElement);
          result.push([]); // => will be: currentLine.length === 0;
          this._debug._ && console.log('↩️ (BR) add to line last element:', currentElement);
          return result;
        }

        // * If the last element was BR, we end current line and start a new one:
        if(currentLine.length === 0) {
          this._debug._ && console.log('⬆️ add to line 1st element:', currentElement);
          currentLine.push(currentElement);
          return result;
        }

        const isVerticalDrop = this._node.isVerticalDrop(currentLine.at(-1), currentElement);

        // * If this is a new line:
        if(isVerticalDrop) {
          result.push([currentElement]);
          this._debug._ && console.log('%c➡️ ◼️ start new line with current:', 'font-weight: bold; color: yellow; background-color: #808080;', currentElement);
          return result;
        }

        if((!isVerticalDrop)) {
          this._debug._ && console.log('⬆️ add to line:', currentElement);
          currentLine.push(currentElement);
          return result;
        }

        this.strictAssert(
            true,
            'groupedPartiallyLinedChildren: An unexpected case of splitting a complex paragraph into lines.',
            '\nOn the element:',
            currentElement
        );
      }, []
    );

    this._debug._ && console.log(
      '🟡🟡🟡 groupedPartiallyLinedChildren \n',
      groupedPartiallyLinedChildren.length,
      [...groupedPartiallyLinedChildren]
    );

    // Consider the paragraph partitioning settings:
    // * this._minParagraphBreakableLines
    // * this._minParagraphLeftLines
    // * this._minParagraphDanglingLines

    if (groupedPartiallyLinedChildren.length < this._minParagraphBreakableLines) {
      this._debug._ && console.log(
          'groupedPartiallyLinedChildren.length < this._minParagraphBreakableLines',
          groupedPartiallyLinedChildren.length, '<', this._minParagraphBreakableLines
        );

      this.logGroupEnd('NOT _splitComplexTextBlockIntoLines');
      // Not to break it up
      return []
    }

    const firstUnbreakablePart = groupedPartiallyLinedChildren.slice(0, this._minParagraphLeftLines).flat();
    const lastUnbreakablePart = groupedPartiallyLinedChildren.slice(-this._minParagraphDanglingLines).flat();
    this._debug._ && console.log(
      'groupedPartiallyLinedChildren', [...groupedPartiallyLinedChildren],
      '\n', 'minLeftLines =', this._minParagraphLeftLines,
      '\n', firstUnbreakablePart,
      '\n', 'minDanglingLines =', this._minParagraphDanglingLines,
      '\n', lastUnbreakablePart
    );
    groupedPartiallyLinedChildren.splice(0, this._minParagraphLeftLines, firstUnbreakablePart);
    groupedPartiallyLinedChildren.splice(-this._minParagraphDanglingLines, this._minParagraphDanglingLines, lastUnbreakablePart);

    // * Then collect the resulting children into rows
    // * which are not to be split further.
    const linedChildren = groupedPartiallyLinedChildren.map(
      (arr, index) => {
        // * Create a new line
        let newLine;

        // const line = this._node.createWithFlagNoBreak();
        // (arr.length > 1) && line.classList.add('group🛗');
        // line.setAttribute('role', 'group〰️');

        if (arr.length == 0) {
          newLine = arr[0];
          newLine.setAttribute('role', '🚫');
          this.strictAssert(arr.length == 0, 'The string cannot be empty (_splitComplexTextBlockIntoLines)')
        // } else if (arr.length == 1) {
        //   newLine = arr[0];
        // * Wrap every split line in textGroup to stabilize measurements:
        // * each line gets a block-level wrapper, while inline flow is preserved inside the group,
        // * keeping the original visual appearance.`
        } else {
          const group = this._node.createTextGroup();
          newLine = group;
          // * Replace the array of elements with a line
          // * that contains all these elements:
          this._DOM.insertBefore(arr[0], newLine);
          this._DOM.insertAtEnd(newLine, ...arr);
        }
        newLine.dataset.child = index;

        // * Return a new unbreakable line.
        return newLine;
      }
    );

    this.logGroupEnd('OK _splitComplexTextBlockIntoLines');

    this._node.setMark(node, 'split');

    return linedChildren
  }

  _breakItIntoLines(splittedItem) {
    // return splittedItem
    // *** item.lines > 1 && !this._node.isNoBreak
    this._debug._ && console.group('_breakItIntoLines', [splittedItem]);

    // *** over-checking
    if (this._node.isNoBreak(splittedItem)) {
      this.logGroupEnd('isNoBreak');
      return splittedItem
    }

    // * TEXT NODE
    if (this._node.isWrappedTextNode(splittedItem)) {
      const newLines =  this._breakWrappedTextNodeIntoLines(splittedItem);
      this.logGroupEnd('TextNode newLines');
      return newLines
    }

    // * INLINE NODE
    this.logGroupEnd('(recursive _breakItIntoLines)');
    return this._processNestedInlineElements(splittedItem);
  }

  _processNestedInlineElements(node) {
    this._debug._ && console.group('_processNestedInlineElements', [node]);
    const preparedChildren = this._getNestedInlineChildren(node);
    const linedChildren = preparedChildren.flatMap(child => {
      return (this._estimateLineCount(child) > 1) ? this._breakItIntoLines(child) : child;
    });
    const splitters = this._findNewLineStarts(linedChildren, node);

    const parts = splitters.map((splitter, i) => {
      const startElement = linedChildren[splitter];
      const endElement = linedChildren[splitters[i + 1]];
      return this._node.cloneAndCleanOutsideRange(node, startElement, endElement);
    });
    this._DOM.insertInsteadOf(node, ...parts);

    this.logGroupEnd('Nested Inline parts');
    return parts;
  }

  _getNestedInlineChildren(element) {
    let nestedInlineChildren = [...this._DOM.getChildNodes(element)]
    .reduce(
      (acc, item) => {

        // TODO: use a more detailed algorithm from 'children'

        // * wrap text node, use element.nodeType
        if (this._node.isSignificantTextNode(item)) {
          const textNodeWrapper = this._node.createTextNodeWrapper();
          this._DOM.wrap(item, textNodeWrapper);
          acc.push(textNodeWrapper); // TODO
          return acc;
        }

        // * no offset parent (contains) -> _node.getPreparedChildren
        if (!this._DOM.getElementOffsetParent(item)) {
          const ch = this._node.getPreparedChildren(item);
          ch.length > 0 && acc.push(...ch);
          return acc;
        }

        // * normal -> _getNestedInlineChildren
        if (this._DOM.isElementNode(item)) {
          const innerChildren = this._getNestedInlineChildren(item);
          innerChildren.forEach(item => acc.push(item))
          return acc;
        };

      }, [])

  return nestedInlineChildren;
  }

  _makeWordsFromTextNode(splittingTextNode) {
    // Split the splittingTextNode into <html2pdf4doc-word>.

    // * array with words:
    const wordArray = this._node.splitTextByWordsGreedy(splittingTextNode);
    this._debug._ && console.log('wordArray', wordArray);

    // * array with words wrapped with the inline tag 'html2pdf4doc-word':
    const wrappedWordArray = wordArray.map((item, index) => {
      return this._node.createWord(item + WORD_JOINER, index);
    });
    this._debug._ && console.log('wrappedWordArray', wrappedWordArray);

    return {wordArray, wrappedWordArray}
  }

  // _splitTextNodeIntoWords

  _breakWrappedTextNodeIntoLines(splittedItem) {
    splittedItem.classList.add('🔠_breakItIntoLines');
    splittedItem.classList.add('🚫_must_be_removed');

    const {
      wordArray,
      wrappedWordArray,
    } = this._makeWordsFromTextNode(splittedItem);

    // Replacing the contents of the splittedItem with a span sequence:
    // splittedItem.innerHTML = '';
    this._DOM.setInnerHTML(splittedItem, '');
    this._DOM.insertAtEnd(splittedItem, ...wrappedWordArray);
    // this._DOM.insertInsteadOf(splittedItem, ...wrappedWordArray);

    // Split the splittedItem into lines.
    // Let's find the elements that start a new line.

    const beginnerNumbers = this._findNewLineStarts(wrappedWordArray, splittedItem);

    // Create the needed number of lines,
    // fill them with text from wordArray, relying on the data from beginnerNumbers,
    // and replace splittedItem with these lines:
    // * insert new lines before the source element,
    const newLines = beginnerNumbers.reduce(
      (result, currentElement, currentIndex) => {
        const line = this._node.createTextLine();

        const start = beginnerNumbers[currentIndex];
        const end = beginnerNumbers[currentIndex + 1];
        // FIXME
        // ? need to add safety spaces at both ends of the line:
        // const text = ' ' + wordArray.slice(start, end).join(WORD_JOINER) + WORD_JOINER + ' ';
        const text = wordArray.slice(start, end).join(WORD_JOINER) + WORD_JOINER;
        this._DOM.setInnerHTML(line, text);
        this._DOM.insertBefore(splittedItem, line);

        result.push(line);
        return result;
      }, []);

    // * and then delete the source element.
    splittedItem.remove();
    return newLines;
  }

  _findNewLineStarts(wrappedWordsArray, wrapper) {
    // * The heuristics _findNewLineStarts stop working if the line height is small
    // * and the lines overlap each other. Therefore, we set a temporary protective line height,
    // * which will make the difference between lines more explicit;
    // * it does not affect the calculation result — we need the beginnings of lines,
    // * not their vertical parameters.
    const cashInlineLineHeight = wrapper.style.lineHeight;
    wrapper.style.lineHeight = 2;

    // Split the splittedItem into lines.
    // Let's find the elements that start a new line.

    const newLineStartNumbers = wrappedWordsArray.reduce(
      (result, currentWord, currentIndex) => {
        const prevTop = (currentIndex > 0) ? wrappedWordsArray[currentIndex - 1].offsetTop : undefined;
        const prevHth = (currentIndex > 0) ? wrappedWordsArray[currentIndex - 1].offsetHeight : undefined;
        const currTop = currentWord.offsetTop;
        if (currentIndex > 0 && (prevTop + prevHth) <= currTop) {
          result.push(currentIndex);
        }
        return result;
      }, [0]
    );

    // * return initial style
    wrapper.style.lineHeight = cashInlineLineHeight;
    return newLineStartNumbers
  }
}
