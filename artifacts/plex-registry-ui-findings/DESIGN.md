# CaastorOS — Plex Registry

## Direction contract

**THESIS** — A calm, auditable registry for creative intelligence; it refuses the crowded “AI dashboard” look and makes the work legible before it becomes decorative.

**OWN-WORLD** — Mineral paper, graphite rules, cobalt actions, and signal-green live states. IBM Plex Sans carries interface copy, IBM Plex Serif gives names and editorial headings a human register, and IBM Plex Mono is reserved for IDs, counts, and system labels. Geometry is square-edged (4px controls, 1px rules), with depth coming from restrained graphite shadows.

**STORY** — A client can see what is live, what each specialist does, how much a run costs, and open the inspector to act. The interface proves transparency through visible status, credits, capabilities, and a reversible run action.

**FIRST VIEWPORT** — Persistent rail at left, 72px workspace header, then a generous page title and one registry table. Rows carry identity, role, live state, credits, and a clear affordance; the right inspector opens only when requested.

**FORM** — Operate mode, list-first registry with an optional card view. Responsive behavior collapses the rail into a bottom navigation and the table into two-column rows without hiding status or action.

## System rules

- Palette: `#F7F8F6` mineral paper, `#FFFFFF` surface, `#15191F` graphite, `#2457D6` cobalt, `#1D9A63` signal.
- Typography: IBM Plex Sans / Serif / Mono; no legacy Inter, Instrument Serif, yellow, or violet defaults.
- Controls: square 4px corners, visible focus ring, 36–40px minimum control height.
- Motion: short route fade and purposeful drawer transition; respect `prefers-reduced-motion`.
- Accessibility: keyboard-focusable registry rows, semantic labels, readable contrast, and status text paired with status color.

## Prototype surface

The working reference is available at `#/specialists`. It demonstrates the rail, workspace header, search, sort, department filters, list/grid toggle, keyboard-accessible rows, specialist inspector, pinning, and the live run panel.
