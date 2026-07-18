export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
  Workgroup: '7867abbd-420e-4dd9-bad6-8ad894c50b94', // Custom ontology — not yet registered in the Ontology service
  Organization: 'ad226473-640e-4d16-90e5-2fd96f261554', // Custom ontology — not yet registered in the Ontology service
  Availability: 'fcdc28d2-f22e-469b-a2f0-dad6bf3dd152', // Custom ontology — not yet registered in the Ontology service
  Membership: 'd300f6d4-a018-446c-add4-b34abc95de05', // Custom ontology — not yet registered in the Ontology service. Written to the MEMBER's own vault, not the community's.
} as const
