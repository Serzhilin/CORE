---
title: "Ontology: AvailabilityLog"
w3id: "8e1879de-79a0-534a-8e25-c74b76b8815a"
---

UUID: `9cf4bb82-d18c-4eb8-b1cc-6730026800c7` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Written to the **member's own vault**, one immutable envelope per closed-out
availability period (never updated, only created). Payload shape (source:
`api/src/services/availabilityLogPayload.ts`):

```json
{
  "v": 1,
  "communityEname": "string",
  "typeName": "string",
  "typeEmoji": "string",
  "reason": "string | null",
  "fromDate": "ISO date-time string",
  "untilDate": "ISO date-time string"
}
```

Write-only from CORE's side — no inbound handler registered.
