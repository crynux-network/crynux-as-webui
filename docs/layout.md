# UI Layout

This document is the layout and typography specification for Crynux AS WebUI. UI design and implementation MUST satisfy every requirement in this document.

## Title line wrapping

Title-class text includes page titles, section titles, card titles, hero headlines, primary CTA labels, and short supporting lines placed directly under a primary CTA.

Title-class text MUST stay on one line whenever the available width allows.

When wrapping cannot be avoided:

1. The break MUST produce balanced line lengths.
2. The last line MUST NOT contain only a single word.
3. A layout that leaves one orphan word on its own line MUST NOT ship.

When a short title-class line fits the intended viewport widths as one line, the implementation MUST keep it on one line (for example with `whitespace-nowrap` or an equivalent width constraint that does not force a wrap).

## Information layout

Before laying out a list or card, fields MUST be ranked by how much they help the user understand the row at a glance. The highest-ranked fields MUST occupy the most visible positions and MUST receive more visual weight. Lower-ranked fields MUST be smaller, secondary, or omitted.

Values that are raw, internal, or only useful on a detail page MUST be omitted when a shorter derived value already communicates the same fact. A long secondary number or string MUST NOT dominate the row or break the layout.

List items MUST be easy to tell apart. Separation between items MUST be stronger than separation between fields inside one item.

When a row shows both a human-readable name and a technical identifier (address, selector, id, or similar), the name MUST receive more visual weight than the identifier.
