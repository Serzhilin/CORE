---
title: "Ontology: PlatformInfo"
w3id: null
---

UUID: `18a83870-04cf-4694-817a-edf037d7b256` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Written to CORE's **own** platform eVault (not a member's or community's) —
this document itself is one such envelope. Payload shape:

```json
{
  "title": "string",
  "audience": "\"user\" | \"marketplace\" | \"agents\" | \"ontology-spec\"",
  "content": "string (markdown body)",
  "updatedAt": "ISO date-time string"
}
```

Write-only, sole writer is CORE itself — no inbound handler registered.
Source of truth for these docs: `docs/platform-info/**/*.md` in this repo,
published via `npm run sync-platform-info --prefix api`.
