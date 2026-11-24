// Feather token schemas. The current schema is feather-tokens/3; feather-tokens/2 and qooe-tokens/1 (Feather under
// QOOE, up to 1.7.0) still work and migrate on read. Deterministic: no network, no dependencies.

export const TOKEN_SCHEMA = "feather-tokens/3"

/** Schemas Feather can read, oldest first. */
export const KNOWN_SCHEMAS = ["qooe-tokens/1", "feather-tokens/2", TOKEN_SCHEMA]

/**
 * Brand tokens in, feather-tokens/3 out. A document without a `schema` field is a qooe-tokens/1 brand (that schema
 * never declared itself). Each step is additive:
 * - qooe-tokens/1 → feather-tokens/2 keeps every field and semantic role name, so it only stamps the schema;
 * - feather-tokens/2 → feather-tokens/3 keeps every field too. /3 only adds (open fonts, the display scale, the
 *   expression motion roles and the contrast, surface and focus axes); `pace` starts from the /2 `motion` axis and
 *   `focus` stays "primary", the ring the brand already had.
 * `from` says what was read: the engine emits the /3 expression block only for a document written as /3, so a /2
 * brand's theme CSS stays byte for byte what it was.
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
  const tokens = { ...input, schema: TOKEN_SCHEMA }
  if (from !== TOKEN_SCHEMA) {
    // An older brand keeps what it had: its pace is its motion axis, and its focus ring stays the primary color.
    if (tokens.pace === undefined && (tokens.motion === "calm" || tokens.motion === "snappy")) tokens.pace = tokens.motion
    if (tokens.focus === undefined) tokens.focus = "primary"
  }
  return { ok: true, tokens, from }
}
