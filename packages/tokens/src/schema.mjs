// Feather token schemas. The current schema is feather-tokens/2; qooe-tokens/1 (Feather under QOOE, up to 1.7.0)
// still works and migrates on read. Deterministic: no network, no dependencies.

export const TOKEN_SCHEMA = "feather-tokens/2"

/** Schemas Feather can read, oldest first. */
export const KNOWN_SCHEMAS = ["qooe-tokens/1", TOKEN_SCHEMA]

/**
 * Brand tokens in, feather-tokens/2 out. A document without a `schema` field is a qooe-tokens/1 brand (that schema
 * never declared itself). feather-tokens/2 keeps every qooe-tokens/1 field and semantic role name, so the
 * migration only stamps the schema; a later breaking change to the token shape gets its own step here.
 * Returns { ok: true, tokens, from } or { ok: false, problems }.
 */
export function migrateTokens(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, problems: ["brand tokens must be a JSON object"] }
  }
  const from = input.schema ?? "qooe-tokens/1"
  if (!KNOWN_SCHEMAS.includes(from)) {
    return { ok: false, problems: [`schema "${from}" is not one Feather reads (${KNOWN_SCHEMAS.join(", ")})`] }
  }
  return { ok: true, tokens: { ...input, schema: TOKEN_SCHEMA }, from }
}
