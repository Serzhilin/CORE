---
title: "Ontology: Membership"
w3id: "c6b79b6a-ee03-59c6-81c1-210a33bae81d"
---

UUID: `d300f6d4-a018-446c-add4-b34abc95de05` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Written to the **member's own vault**, not the community's. Payload shape
(source: `api/src/services/membershipPayload.ts`):

```json
{
  "v": 1,
  "communityEname": "string",
  "joinedAt": "ISO date-time string"
}
```

Write-only from CORE's side — no inbound handler registered.
