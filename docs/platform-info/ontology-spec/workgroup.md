---
title: "Ontology: Workgroup"
w3id: "37f3c8af-ffda-5532-91c3-4fe79f98d843"
---

UUID: `7867abbd-420e-4dd9-bad6-8ad894c50b94` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Payload shape (source: `api/src/services/workgroupPayload.ts`):

```json
{
  "communityId": "string",
  "name": "string",
  "description": "string (optional)",
  "color": "string",
  "createdAt": "ISO date-time string",
  "updatedAt": "ISO date-time string",
  "roles": [{ "id": "string", "name": "string", "color": "string" }],
  "members": [{ "participantId": "string", "roleIds": ["string"] }],
  "chatId": "string (optional)"
}
```
