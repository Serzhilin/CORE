---
title: "Ontology: User"
w3id: "353fa9ea-ccc9-5331-bf10-4d06713503fe"
---

UUID: `550e8400-e29b-41d4-a716-446655440000` (source: `api/src/lib/w3ds/ontology.ts`)

Two distinct uses in CORE:

1. **Person profile** — read inbound via webhook in
   `api/src/services/PersonService.ts`'s `upsertFromWebhook`. Tolerant field
   reader, accepts either of:
   - `displayName` or `name`
   - `firstName` or `givenName`
   - `lastName` or `familyName`

2. **Platform self-representation** — written once by
   `api/scripts/register-platform.ts`'s `writePlatformProfile()`:

```json
{
  "platformName": "string",
  "displayName": "string",
  "description": "string",
  "ename": "string",
  "url": "string",
  "logoUrl": "string",
  "category": "string",
  "isActive": "boolean",
  "isArchived": "boolean",
  "version": "string",
  "createdAt": "ISO date-time string",
  "updatedAt": "ISO date-time string"
}
```
