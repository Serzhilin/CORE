---
title: "Ontology: Community"
w3id: null
---

UUID: `550e8400-e29b-41d4-a716-446655440003` (source: `api/src/lib/w3ds/ontology.ts`)

Uses the shared W3DS Chat envelope shape (not a CORE-specific payload) — a
Community in CORE is represented as a Chat group. `participantsID` fields on
this envelope are MetaEnvelope IDs of each member's `User` profile envelope,
not their eName.
