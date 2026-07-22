---
title: "Ontology: Organization"
w3id: "6e6ac5fc-e545-5018-9f04-c9f6ebdf7048"
---

UUID: `ad226473-640e-4d16-90e5-2fd96f261554` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Payload shape (source: `api/src/services/organizationPayload.ts`), key fields:

```json
{
  "name": "string | null",
  "chatId": "string | null",
  "legalInfo": {
    "legalForm": "string | null",
    "officialName": "string | null",
    "kvkNumber": "string | null",
    "rsin": "string | null",
    "iban": "string | null",
    "registeredAddress": "string | null",
    "foundingDate": "string | null (YYYY-MM-DD)"
  },
  "membershipTypes": [{ "id": "string", "name": "string", "description": "string | null", "emoji": "string | null" }],
  "members": [{ "participantId": "string", "eName": "string", "dateJoined": "string | null", "membershipTypeId": "string | null" }],
  "admins": ["string"]
}
```

Field list abbreviated to what's relevant to other platforms — the full type
is `OrganizationEnvelopePayload` in the source file above.
