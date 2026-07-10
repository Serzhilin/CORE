import axios from 'axios'
import { logger } from './logger'
import { ONTOLOGIES } from './w3ds/ontology'

// Static developer API key — obtained once from MetaState, set in .env.
// Sent as Authorization: Bearer on every eVault request. No per-request token exchange
// (the old /platforms/certification flow has been removed from the protocol).
const DEVELOPER_API_KEY = process.env.DEVELOPER_API_KEY ?? ''

interface EnvelopeInput {
  vaultEname: string
  ontology: string
  payload: Record<string, unknown>
  acl: string[]
}

interface UpdateInput extends EnvelopeInput {
  envelopeId: string
}

function buildHeaders(vaultEname: string): Record<string, string> {
  const normalized = vaultEname.startsWith('@') ? vaultEname : `@${vaultEname}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-ENAME': normalized,
  }
  if (DEVELOPER_API_KEY) headers['Authorization'] = `Bearer ${DEVELOPER_API_KEY}`
  return headers
}

async function resolveGraphqlEndpoint(ename: string): Promise<string> {
  const registryUrl = process.env.PUBLIC_REGISTRY_URL!
  const normalized = ename.startsWith('@') ? ename : `@${ename}`
  const res = await axios.get<{ uri: string }>(
    `${registryUrl}/resolve?w3id=${encodeURIComponent(normalized)}`,
    { timeout: 10_000 }
  )
  return `${res.data.uri}/graphql`
}

async function gqlRequest<T>(
  vaultEname: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const endpoint = await resolveGraphqlEndpoint(vaultEname)
  const res = await axios.post<{ data: T; errors?: Array<{ message: string }> }>(
    endpoint,
    { query, variables },
    { headers: buildHeaders(vaultEname), timeout: 10_000 }
  )
  if (res.data.errors?.length) throw new Error(res.data.errors[0].message)
  return res.data.data
}

// ── Mutations ────────────────────────────────────────────────────────────────

const GQL_CREATE = `
  mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
    createMetaEnvelope(input: $input) {
      metaEnvelope { id }
      errors { field message code }
    }
  }
`

const GQL_UPDATE = `
  mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
    updateMetaEnvelope(id: $id, input: $input) {
      metaEnvelope { id }
      errors { field message code }
    }
  }
`

const GQL_FETCH = `
  query GetMetaEnvelope($id: ID!) {
    metaEnvelope(id: $id) { id ontology parsed }
  }
`

const GQL_FIND_BY_ONTOLOGY = `
  query FindByOntology($ontologyId: ID, $first: Int, $after: String) {
    metaEnvelopes(filter: { ontologyId: $ontologyId }, first: $first, after: $after) {
      edges { cursor node { id ontology parsed } }
      pageInfo { hasNextPage endCursor }
    }
  }
`

const GQL_REMOVE = `
  mutation RemoveMetaEnvelope($id: ID!) {
    removeMetaEnvelope(id: $id) {
      deletedId
      success
      errors { message code }
    }
  }
`

export async function createEnvelope(input: EnvelopeInput): Promise<string> {
  const data = await gqlRequest<{
    createMetaEnvelope: {
      metaEnvelope: { id: string }
      errors?: Array<{ message?: string }>
    }
  }>(input.vaultEname, GQL_CREATE, {
    input: { ontology: input.ontology, payload: input.payload, acl: input.acl },
  })
  if (data.createMetaEnvelope.errors?.length) {
    throw new Error(data.createMetaEnvelope.errors[0]?.message ?? 'createEnvelope failed')
  }
  return data.createMetaEnvelope.metaEnvelope.id
}

export async function updateEnvelope(input: UpdateInput): Promise<void> {
  const data = await gqlRequest<{
    updateMetaEnvelope: {
      metaEnvelope: { id: string }
      errors?: Array<{ message?: string }>
    }
  }>(input.vaultEname, GQL_UPDATE, {
    id: input.envelopeId,
    input: { ontology: input.ontology, payload: input.payload, acl: input.acl },
  })
  if (data.updateMetaEnvelope.errors?.length) {
    throw new Error(data.updateMetaEnvelope.errors[0]?.message ?? 'updateEnvelope failed')
  }
}

export async function removeEnvelope(vaultEname: string, envelopeId: string): Promise<void> {
  const data = await gqlRequest<{
    removeMetaEnvelope: { deletedId: string | null; success: boolean; errors?: Array<{ message?: string }> }
  }>(vaultEname, GQL_REMOVE, { id: envelopeId })
  if (!data.removeMetaEnvelope.success || data.removeMetaEnvelope.errors?.length) {
    throw new Error(data.removeMetaEnvelope.errors?.[0]?.message ?? 'removeEnvelope failed')
  }
}

export async function getEnvelope(
  vaultEname: string,
  envelopeId: string
): Promise<Record<string, unknown> | null> {
  try {
    const data = await gqlRequest<{
      metaEnvelope: { id: string; ontology: string; parsed: Record<string, unknown> | null }
    }>(vaultEname, GQL_FETCH, { id: envelopeId })
    return data.metaEnvelope?.parsed ?? null
  } catch (err) {
    logger.warn(err, 'getEnvelope failed for vault %s envelope %s', vaultEname, envelopeId)
    return null
  }
}

export async function findEnvelopesByOntology(
  vaultEname: string,
  ontology: string,
  maxResults = 500
): Promise<Array<{ id: string; parsed: Record<string, unknown> | null }>> {
  const PAGE_SIZE = 100
  const results: Array<{ id: string; parsed: Record<string, unknown> | null }> = []
  let cursor: string | null = null

  type PageResult = {
    metaEnvelopes: {
      edges: Array<{ node: { id: string; parsed: Record<string, unknown> | null } }>
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }

  try {
    while (true) {
      const page: PageResult = await gqlRequest<PageResult>(vaultEname, GQL_FIND_BY_ONTOLOGY, {
        ontologyId: ontology,
        first: Math.min(PAGE_SIZE, maxResults - results.length),
        after: cursor ?? undefined,
      })

      for (const edge of page.metaEnvelopes.edges) {
        results.push(edge.node)
      }

      if (page.metaEnvelopes.pageInfo.hasNextPage && results.length < maxResults) {
        cursor = page.metaEnvelopes.pageInfo.endCursor
      } else {
        break
      }
    }

    return results
  } catch (err) {
    logger.warn(err, 'findEnvelopesByOntology failed for vault %s ontology %s', vaultEname, ontology)
    return []
  }
}

/**
 * Resolves an eName to the MetaEnvelope ID of their User profile envelope.
 * Per W3DS protocol, participantIds/admins in Chat envelopes store this ID — NOT the eName.
 * Returns null if the User envelope cannot be found.
 */
export async function getUserMetaEnvelopeId(ename: string): Promise<string | null> {
  try {
    const envelopes = await findEnvelopesByOntology(ename, ONTOLOGIES.User, 1)
    return envelopes[0]?.id ?? null
  } catch (err) {
    logger.warn(err, 'getUserMetaEnvelopeId failed for %s', ename)
    return null
  }
}

/**
 * Resolves a w3ds://file URI to its public HTTP URL.
 * Format: w3ds://file?id=@<ename>/<metaEnvelopeId>
 * Non-w3ds URLs are returned as-is.
 */
export async function resolveW3dsFileUrl(url: string): Promise<string | null> {
  if (!url) return null
  if (!url.startsWith('w3ds://file')) return url
  try {
    const raw = url.replace('w3ds://', 'w3ds-hack://')
    const params = new URL(raw).searchParams
    const id = params.get('id') // "@ename/metaId"
    if (!id) return null
    const slash = id.indexOf('/')
    if (slash < 0) return null
    const ename = id.slice(0, slash)
    const metaId = id.slice(slash + 1)
    const envelope = await getEnvelope(ename, metaId)
    return (envelope?.publicUrl as string | undefined) ?? null
  } catch (err) {
    logger.warn(err, 'resolveW3dsFileUrl failed for %s', url)
    return null
  }
}
