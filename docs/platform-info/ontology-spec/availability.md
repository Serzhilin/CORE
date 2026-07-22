---
title: "Ontology: Availability"
w3id: null
---

UUID: `fcdc28d2-f22e-469b-a2f0-dad6bf3dd152` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Payload shape (source: `api/src/services/availabilityPayload.ts`):

```json
{
  "statuses": [{ "id": "string", "name": "string", "emoji": "string", "sortOrder": "number" }],
  "entries": [{ "participantId": "string", "eName": "string", "statusId": "string", "reason": "string | null", "from": "string | null", "until": "string | null" }]
}
```

Members with no status currently set are omitted from `entries` rather than
synced as a bare `participantId`/`eName` pair.
