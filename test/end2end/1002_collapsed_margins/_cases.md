# Collapsed Margins Cases (Preview Heuristics)

## Implemented cases (page-boundary collapse)

- case_chain_base.html
  - Purpose: nested children; equal boundary offsets across the chain.
  - Expectation: margin is zeroed along the full chain at both page boundaries.

- case_chain_base_negative_margin.html
  - Purpose: negative margins collapse with the parent (boundaries equal).
  - Expectation: heuristic would zero; known limitation for negative margins.

- case_chain_parent_padding.html
  - Purpose: parent has padding (top/bottom); first/last child starts/ends inside.
  - Expectation: child boundary != parent boundary; stop chain and do not zero deeper.

- case_chain_parent_border.html
  - Purpose: parent has border (top/bottom); first/last child starts/ends inside.
  - Expectation: child boundary != parent boundary; stop chain and do not zero deeper.

- case_chain_child_mid_padding.html
  - Purpose: chain has depth, but breaks in the middle due to padding on a nested child.
  - Expectation: zero margins only until the first mismatch, then stop.

- case_chain_child_inline.html
  - Purpose: first/last child is inline text wrapper.
  - Expectation: chain stops at inline; no collapse path.

- case_chain_child_absolute.html
  - Purpose: first/last child contains absolute content (non-collapsing).
  - Expectation: chain stops; no collapse path.

- case_chain_child_float.html
  - Purpose: first/last child is float (out of flow).
  - Expectation: float is skipped; collapse chain follows the next/previous in-flow sibling.

- case_chain_child_clear_float.html
  - Purpose: clear + float introduces clearance and breaks adjacency.
  - Expectation: child boundary != parent boundary; no collapse; do not zero deeper.

## Not implemented / TODO (known cases)

- not_implemented_TODO/case_negative_margin_compensation_???.html
  - Purpose: negative margin edge case (tbd).
  - Expectation: known limitation.

- not_implemented_TODO/case_relative_compensation_???.html
  - Purpose: relative-position compensation edge case (tbd).
  - Expectation: known limitation.

#### (old fixture drafts)

- not_implemented_TODO/case_negative_margin_compensation.html
  - Purpose: negative margin variant (top).
  - Expectation: heuristic would zero; known limitation.

- not_implemented_TODO/case_negative_margin_compensation_bottom.html
  - Purpose: negative margin variant (bottom).
  - Expectation: heuristic would zero; known limitation.

- not_implemented_TODO/case_relative_compensation.html
  - Purpose: position: relative/top compensates margin.
  - Expectation: heuristic would zero; known limitation.

- not_implemented_TODO/case_relative_compensation_bottom.html
  - Purpose: position: relative/bottom compensates margin.
  - Expectation: heuristic would zero; known limitation.

- not_implemented_TODO/case_transform_compensation.html
  - Purpose: transform/translateY compensates margin.
  - Expectation: heuristic would zero; known limitation.

- not_implemented_TODO/case_transform_compensation_bottom.html
  - Purpose: transform/translateY compensates margin at the bottom.
  - Expectation: heuristic would zero; known limitation.
