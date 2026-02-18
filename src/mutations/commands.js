/**
 * Creates a mutation that hides an ignorable spacer paragraph.
 */
export function createHideIgnorableSpacerParagraphMutation({ DOM, element }) {
  return function hideIgnorableSpacerParagraph() {
    if (!DOM || !element) {
      return;
    }
    DOM.setStyles(element, { display: ['none', 'important'] });
    // Debug marker to visually confirm deferred hiding in dev scenarios.
    DOM.addClasses(element, '🕶️');
  };
}

