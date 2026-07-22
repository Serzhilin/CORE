---
title: "Ontology: Community"
w3id: "d9dd7b74-2162-5a72-9a16-ffa8ad3136de"
---

UUID: `550e8400-e29b-41d4-a716-446655440003` (source: `api/src/lib/w3ds/ontology.ts`)

Uses the shared W3DS Chat envelope shape (not a CORE-specific payload) — a
Community in CORE is represented as a Chat group. `participantsID` fields on
this envelope are MetaEnvelope IDs of each member's `User` profile envelope,
not their eName.
