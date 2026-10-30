## Full Picture

Before making any changes, consult [`./architecture.md`](./architecture.md) for the frontend architecture. All modifications must be consistent with the existing design. Project management UI behavior MUST follow [`./project-management.md`](./project-management.md).

### Cost Level static layout

When editing the project Cost Level panel in `src/views/ProjectDetailView.vue`, static-mode control layout MUST follow `project-management.md` section **Static Cost Level control layout**. After the change, verify:

1. Top row is Cost Level input beside the slider; Task queue panel below spans full card content width; queue bar left/right edges align with the slider track via the shared column grid.
2. Left numeric box stays tall (`h-20`) with primary flex-centered digits and sits directly left of the slider as one control.
3. Max Credits per task group sits below Task queue with the same controls as Auto; spacing between that block and Max Credits uses `space-y-10`.
4. Larger gaps: intro text to mode cards (`mb-10`), mode cards to control block (`mb-20`), control block to example tables (`mb-20`).

### Cost Level auto layout

When editing auto-mode controls in `src/views/ProjectDetailView.vue`, layout MUST follow `project-management.md` section **Auto Cost Level control layout**. After the change, verify:

1. Queue position and Max Credits per task are two bordered groups with clear titles and larger spacing between groups.
2. Queue position has a tall left input and an 80%-width centered dual-bar block; Max Credits has a tall left input and an 80%-width centered log Credits slider plus Provider min bar.
3. Queue position slider is limited to `[1, 99]` with a fixed symmetric red–blue–red bar; Max Credits uses a log axis packed from the current value and `provider_min_credits`.

## Documentation Index

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Technical architecture: Vue app layers, directory layout, Pinia stores, wallet login via Reown AppKit and Crynux AS JWT, API client, dashboard routing and layout |
| [project-management.md](./project-management.md) | Project list and detail views: Cost Level, Playground, usage, recent requests, and Cost Level control layouts |
| [earn.md](./earn.md) | Shared Keys page: Shared API Key lifecycle, Key Owner CNX balances and histories, and personal-sign withdrawal flow |
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
