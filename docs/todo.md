
Gaps — things a new app will almost certainly need that never got extracted, because CORE either doesn't have them as reusable patterns or kept them app-coupled:

Avatar — initials-in-circle pattern hand-rolled 4+ places in CORE (TopBar, InfoPanel, PersonModal, CardGrid), never componentized.
Icon system — every SVG (×, chevron, trash, arrow) copy-pasted inline per file. No shared Icon.
Dropdown/Menu — TopBar's account menu uses Panel + a local MenuItem, but MenuItem itself stayed in CORE, not extracted.
Table — MembersTab's table is fully hand-rolled, zero shared table primitives.
Tabs/nav — AdminPanel-style section switching stays local.
Checkbox/Radio/Switch — plain unstyled <input type="checkbox"> in OrganogramView, no styled component.
Toast/alert/banner — errors surface via alert() or plain colored <span>, no in-app notification component.
Loading/skeleton state — "Loading…" text hand-written per view.
Label — <label style={{...}}> repeated with the same fontSize/fontWeight/marginBottom every form field, never pulled into a component.
Typography scale — no Heading/Text components; font sizes stay magic literals (0.85rem, 0.72rem...) per file.
Page/layout shell — no Container/Sidebar/Stack — each view builds its own root flex div from scratch.