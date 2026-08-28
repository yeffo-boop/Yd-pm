# ADR 0006: react-big-calendar for month/week views; custom-built timeline/Gantt component (no third-party Gantt library)

## Status

Proposed (Phase 0)

## Context

The spec requires month and week calendar views, a timeline/Gantt-style
project view, owner drag-and-drop rescheduling with an accessible non-drag
alternative, and explicitly asks Phase 0 to identify license/deployment
constraints for any timeline/Gantt/calendar library, while also cautioning
against adding large dependencies without justification and preferring a
focused, maintainable implementation.

Surveyed options:

- **react-big-calendar** — MIT license, mature, React-native (not a DOM-
  managing wrapper around a non-React library), supports month/week/agenda
  views out of the box.
- **frappe-gantt** — MIT license, framework-agnostic, manages its own DOM;
  React usage requires a wrapper and fighting its imperative rendering
  model inside React's declarative one.
- **dhtmlx-gantt Community Edition** — MIT-licensed core, but it's a large,
  feature-rich library (its own theming, its own DOM/event model, upsell
  paths to a commercial edition for advanced features) — more surface area
  than a ~25-project MVP's phase/milestone timeline needs, and the same
  React-wrapper friction as frappe-gantt.
- **vis-timeline** — MIT, capable, same non-React-native DOM-management
  characteristic.

At MVP scale, a project's "Gantt" view shows a handful of phases, each with
a handful of milestones, over a period of months — not hundreds of rows,
resource leveling, or critical-path computation.

## Decision

- **Calendar (month/week):** `react-big-calendar` (MIT). It's React-native,
  actively maintained, and directly covers the required views without a
  wrapper layer.
- **Timeline/Gantt-style project view:** a **custom-built** component using
  CSS Grid for the time-axis layout and `@dnd-kit` for drag interactions,
  rather than adopting a third-party Gantt library.

## Rationale for building the Gantt view

- Every surveyed Gantt library manages its own DOM/rendering, which fights
  React's model and complicates the accessible-keyboard-alternative
  requirement (dnd-kit is accessibility-first by design; retrofitting
  keyboard support onto a third-party Gantt widget's drag model is
  typically much harder than building the interaction directly).
- The actual rendering need — horizontal bars per phase/milestone against a
  date axis, with dependency lines — is small and well-bounded at this
  project scale, so "avoid large dependencies without explaining why
  necessary" (spec §working rules) points toward not adding one.
- A custom component shares data models, date-shift preview logic, and
  styling tokens directly with the rest of the app instead of adapting to
  a third-party library's own configuration/theming system.

## Consequences

- YeffoDesign owns the timeline component's edge cases (many overlapping
  bars, very long projects) rather than inheriting a library's. Scoped
  deliberately small; if project complexity grows well past what a simple
  bar chart handles, that is a documented trigger to revisit (e.g., adopt
  dhtmlx Community at that point), not a Phase 4 concern.
- `@dnd-kit` (MIT) is used for both the Kanban board and the timeline drag
  interactions, so there is one drag-and-drop library, one keyboard-
  accessibility pattern, learned and tested once.

## Alternatives considered

See survey above; dhtmlx Community Edition is the fallback documented here
explicitly in case the custom timeline component proves insufficient once
real usage begins.
