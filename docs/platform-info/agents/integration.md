---
title: "Integrating with CORE (for AI agents and platforms)"
w3id: null
---

CORE is a W3DS platform. To read or write CORE-related data from another
platform or agent:

1. Resolve CORE's own eName via the Registry's `/resolve` endpoint (or the
   member's/community's own eName if you're working with their data instead
   of CORE's platform-level data).
2. Query the resulting eVault's `/graphql` endpoint with header
   `X-ENAME: @<the resolved eName>`.

**Ontologies CORE reads back from other platforms** (inbound webhook handlers
registered in `api/src/lib/w3ds/registerOntologyHandlers.ts`): `User`,
`Organization`, `Availability`, `Workgroup`.

**Ontologies CORE only writes** (no inbound handler — CORE is the sole
writer, no other platform should assume it can update these and have CORE
notice): `Membership`, `AvailabilityLog`, `PlatformInfo` (this document
itself, and everything else under `docs/platform-info/` in CORE's repo).

`Community` uses the shared W3DS Chat envelope shape, not a CORE-specific
payload — see `ontology-spec/community.md`.

Full field-level payload shapes for every ontology CORE uses: see the
`ontology-spec/` folder alongside this file.
