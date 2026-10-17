# DELIVERABLE-GATE

## Navigation addendum — Oscar, 17 October 2026

This section supplements the [deliverable-gate planning brief](../handoffs/2026-10-17-deliverable-gate/PROMPT-plan-gate.md). It specifies only navigation and Canvas space allocation. It does not change the gate state machine, generation, review, downloads, sharing, credits, roles, agent roster or prompts. This is a specification, not an implementation.

### Deliverable detail: outside click and preserved state

The deliverable detail opens over the existing Canvas. Clicking the visible Canvas/backdrop outside the detail panel closes the panel and reveals that same Canvas. The panel boundary includes its header, content and footer: clicks inside it do not close it. An explicit navigation control follows its own destination; its click is not consumed as a backdrop click.

Closing the panel is navigation only. Preserve the brief, generated content, current gate/review state, pending work, unsaved draft edits, selected deliverable and panel scroll position. Preserve Canvas pan, zoom and node positions. Reopening the deliverable resumes the same detail state. Closing does not approve, discard, restart, cancel or charge for anything, and does not create an additional run or reload the Canvas. Existing authorization continues to apply.

### Top navigation: placement, labels and destinations

Keep a persistent navigation row above the Canvas and above the deliverable detail content. It stays visible when the detail content scrolls; it must not be hidden behind the panel. Place the back arrow at the far top left of the content area, immediately to the right of the app navigation rail. Place the clickable path immediately after it:

`Canvas → [brief name] → [deliverable name]`

Use the actual saved brief title and the friendly deliverable name, such as `Social Post`, `Email` or `Hero KV`. Do not substitute agent names or codes. Long names may truncate visually, but their full labels remain available to assistive technology. On narrow screens, the path wraps below the back control instead of dropping the brief link.

| View/control | Visible label | Exact click result |
| --- | --- | --- |
| Deliverable detail: back arrow | `← Back to Canvas` | Close the detail panel; restore its Canvas and all preserved state. |
| Canvas: back arrow | `← Back to brief` | Open this brief's existing brief view, preserving its context and state. |
| Path: first item | `Canvas` | Open this brief's Canvas; if detail is open, close it without resetting Canvas state. |
| Path: second item | Actual brief name | Open this brief's existing brief view directly, including when clicked from detail. |
| Path: third item, present in detail | Actual deliverable name | Identify the current deliverable; clicking focuses its existing detail panel without recreating it or changing state. Mark it as the current location. |

On the Canvas the path is `Canvas → [brief name]`; add the deliverable item only while detail is open. The back arrow follows the application hierarchy, not arbitrary browser history: direct entry through a saved link must still have a valid parent destination. The existing brief view retains its existing navigation; this addendum does not redesign it.

**Exact Cake Me return path:** open the brief `Granada, primera rebanada` → open its Canvas → open `Social Post` → click `← Back to Canvas` (or outside the panel) → arrive on the same Canvas → click `← Back to brief` → arrive at the existing `Granada, primera rebanada` brief view. The shortcut from detail is to click `Granada, primera rebanada` in `Canvas → Granada, primera rebanada → Social Post`, which returns directly to the brief. Both paths retain state and perform no gate action.

### Canvas app navigation: rail, hover and pin

For viewport widths of **768 CSS pixels and above**, the Canvas route defaults to a **64 px icon-only left rail**. Retain the existing destinations, icons and authorization rules; each icon keeps its existing destination name as its accessible label and hover label. The Canvas uses the remaining width.

On a hover-capable pointer, hovering over the rail expands it to **240 px** as an overlay, showing the existing destination labels. Leaving the rail collapses the overlay unless pinned. Hover expansion does not resize or recenter the Canvas and does not alter pan, zoom or node positions.

Put a pin toggle at the top of the rail, below the app mark and above the destination icons. Its label is `Pin menu` when unpinned and `Unpin menu` when pinned. Clicking `Pin menu` keeps the expanded menu visible after the pointer leaves; clicking `Unpin menu` restores the icon rail. The toggle remains available without hover, including on touch devices. Expose its selected state accessibly.

Remember the explicit pin/unpin choice per signed-in user in the same browser across Canvas visits and reloads. Default to unpinned when no choice has been saved. Temporary hover expansion is not a saved choice. A pinned menu remains an overlay, so changing the preference never changes the Canvas transform or node coordinates. No DB change is required for this browser preference.

For viewport widths **below 768 CSS pixels**, replace the left rail with a **56 px top bar**: app mark at the leading edge and a `Menu` toggle at the trailing edge. Opening it shows the same existing destinations below the bar as an overlay; selecting a destination follows its existing route. The back/path row sits directly below this bar and remains visible in detail. There is no hover dependency or left rail on small screens. Retain the desktop pin preference while in this layout and restore it when returning to a wider viewport; do not overwrite it because the screen became smaller.

This selects one approach: icon rail with transient hover expansion and explicit pin persistence, with a top-bar variant for small screens. It gives the Canvas space by default while keeping every existing destination reachable.

### Navigation copy

Actual brief and deliverable names are content, not replacement UI labels. Brandolph remains unchanged, in Latin script.

| Control | en | es | ar |
| --- | --- | --- | --- |
| Canvas path item | Canvas | Canvas | لوحة العمل |
| Detail back arrow | Back to Canvas | Volver al Canvas | العودة إلى لوحة العمل |
| Canvas back arrow | Back to brief | Volver al brief | العودة إلى الموجز |
| Pin toggle, off | Pin menu | Fijar menú | تثبيت القائمة |
| Pin toggle, on | Unpin menu | Desfijar menú | إلغاء تثبيت القائمة |
| Small-screen toggle | Menu | Menú | القائمة |

Use the locale's reading direction for control placement and back-arrow direction; the return destinations and path hierarchy remain identical.

### Acceptance checks for this addendum

1. From any deliverable, an outside click returns to its existing Canvas. Reopen it and verify draft edits, content, review state and panel scroll position survive; Canvas transform and node positions are unchanged. No generation, approval or credit request is made by closing/reopening.
2. Verify both the two-step arrow return and the direct brief-name shortcut above, including after entering a deliverable through a direct saved link. The correct brief remains reachable without relying on browser history.
3. Verify path/back controls remain visible while scrolling detail, with long brief names and in en/es/ar. Customer paths contain no agent codes or production metadata.
4. At 768 px and wider, verify the default icon rail, hover expansion/collapse, touch-accessible pin toggle, and remembered pin/unpin choice across reloads. Hover does not overwrite the saved choice. Another signed-in user's preference is separate.
5. Below 768 px, verify the top bar, reachable existing destinations, wrapped path and working return controls. Returning to desktop restores the previous pin choice. No layout transition resets Canvas state.
6. Verify navigation does not expand permissions, change gate behavior or alter any other feature.
