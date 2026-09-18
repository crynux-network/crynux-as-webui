## Full Picture

Before making any changes, consult [`./architecture.md`](./architecture.md) for the frontend architecture. All modifications must be consistent with the existing design.

### Cost Level static layout

When editing the project Cost Level panel in `src/views/ProjectDetailView.vue`, static-mode control layout MUST follow `architecture.md` section **Static Cost Level control layout**. After the change, verify:

1. Queue range bar width matches the slider track left and right edges.
2. Left numeric box stays left-aligned and tall (`h-20`) with primary flex-centered digits; right slider is about 80% of the remaining row width and horizontally centered in that space, with a tighter range-bar height.
3. Larger gaps: intro text to mode cards (`mb-10`), mode cards to control row (`mb-20`), control row to example tables (`mb-20`).

### Cost Level auto layout

When editing auto-mode controls in `src/views/ProjectDetailView.vue`, layout MUST follow `architecture.md` section **Auto Cost Level control layout**. After the change, verify:

1. Queue position and Max Cost Level are two bordered groups with clear titles and larger spacing between groups.
2. Each group has a tall left input and an 80%-width centered dual-bar block.
3. Queue position slider is limited to `[1, 99]` with a fixed symmetric red–blue–red bar; Max Cost Level reuses the live Current queue range bar.

## Documentation Index

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Technical architecture: Vue app layers, directory layout, Pinia stores, wallet login via Reown AppKit and Crynux AS JWT, API client, dashboard routing and layout |
| [layout.md](./layout.md) | UI layout and typography: title line wrapping and information layout for lists and cards |

## Doc Update Requirements

When updating documentation files:

1. Read the entire document first to understand its structure, sections, and flow
2. Find the most appropriate location to integrate new content based on:
   - Logical relationship with existing sections
   - Document flow and narrative
   - Where readers would naturally expect to find the information
3. Integrate new content naturally into existing sections when possible:
   - Add as a paragraph within a relevant section
   - Extend an existing list or table
   - Add as a subsection under an appropriate parent section
   - Distribute across multiple sections if a feature affects different parts of the document
4. Do NOT simply create a new top-level section and place all new content there
5. Only create a new section if the topic is truly distinct from all existing content

Write documentation as a specification.

Documentation MUST state clear, final decisions and requirements.

Documentation MUST NOT include:
- Recommendations or advice.
- Options or alternatives.
- Speculation or uncertainty.
- Future-facing placeholders.

Documentation MUST use definitive language that can be implemented and tested:
- Requirement keywords: MUST, MUST NOT, SHALL, SHOULD. Use SHOULD only when a requirement level is intended.
- Exact behavior, constraints, and interfaces.

## Chat Content Isolation

Documentation MUST be generated from task requirements and authoritative project sources only.
User chat instructions about removing content are editing actions, not document content.
The final document MUST NOT restate removal instructions.
If a content type is removed, it must be absent from the final document.

Example chat cycle:
- AI draft includes setup commands.
- User says remove setup commands and keep only flow.
- Wrong final doc line: This document does not include setup commands.
- Right final doc line: Run the flow in order: prepare environment, start services, execute purchase and withdraw, then verify results.
