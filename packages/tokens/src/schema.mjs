// Feather token schemas. A brand writes feather-tokens/4 (the range layer) or feather-tokens/3 (the expression
// layer); feather-tokens/2 and qooe-tokens/1 (Feather under QOOE, up to 1.7.0) still work and migrate on read.
// Deterministic: no network, no dependencies.

/** The schema an older document (qooe-tokens/1, feather-tokens/2) migrates to on read, and what `feather-brand
 * --migrate` stamps by default. A /3 document stays /3, and a /4 document stays /4. */
export const TOKEN_SCHEMA = "feather-tokens/3"
/** The newest schema: feather-tokens/3 plus loudness, the colour blocks, the media scrim and the motion personality.
 * A document moves to it only on request (`migrateTokens(input, { to: LATEST_SCHEMA })`, `feather-brand --migrate --to 4`). */
export const LATEST_SCHEMA = "feather-tokens/4"

/** Schemas Feather can read, oldest first. */
export const KNOWN_SCHEMAS = ["qooe-tokens/1", "feather-tokens/2", TOKEN_SCHEMA, LATEST_SCHEMA]
/** The schemas a document can be migrated to. */
export const MIGRATION_TARGETS = [TOKEN_SCHEMA, LATEST_SCHEMA]

/**
 * Brand tokens in, a readable document out. A document without a `schema` field is a qooe-tokens/1 brand (that schema
 * never declared itself). Each step is additive:
 * - qooe-tokens/1 → feather-tokens/2 keeps every field and semantic role name, so it only stamps the schema;
 * - feather-tokens/2 → feather-tokens/3 keeps every field too. /3 only adds (open fonts, the display scale, the
 *   expression motion roles and the contrast, surface and focus axes); `pace` starts from the /2 `motion` axis and
 *   `focus` stays "primary", the ring the brand already had;
 * - feather-tokens/3 → feather-tokens/4 only stamps the schema, and only when `to` asks for it. /4 only adds
 *   (loudness, the colour blocks, the media scrim, the motion personality), each with a default.
 * `from` says what was read: the engine emits the /3 expression block only for a document written as /3 or /4, and the
 * /4 range block only for /4, so an older brand's theme CSS stays byte for byte what it was.
 * `to` (optional) is a target in MIGRATION_TARGETS; without it, a /1 or /2 document becomes /3 and a /3 or /4 one is
 * read as it is. A migration never goes down a version.
 * Returns { ok: true, tokens, from } or { ok: false, problems }.
 */
export function migrateTokens(input, { to } = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, problems: ["brand tokens must be a JSON object"] }
  }
  const from = input.schema ?? "qooe-tokens/1"
  if (!KNOWN_SCHEMAS.includes(from)) {
    return { ok: false, problems: [`schema "${from}" is not one Feather reads (${KNOWN_SCHEMAS.join(", ")})`] }
  }
  if (to !== undefined && !MIGRATION_TARGETS.includes(to)) {
    return { ok: false, problems: [`cannot migrate to "${to}": the targets are ${MIGRATION_TARGETS.join(", ")}`] }
  }
  const level = KNOWN_SCHEMAS.indexOf(from)
  if (to !== undefined && KNOWN_SCHEMAS.indexOf(to) < level) {
    return { ok: false, problems: [`cannot migrate ${from} down to ${to}: a migration only adds`] }
  }
  const target = to ?? (level >= KNOWN_SCHEMAS.indexOf(TOKEN_SCHEMA) ? from : TOKEN_SCHEMA)
  const tokens = { ...input, schema: target }
  if (level < KNOWN_SCHEMAS.indexOf(TOKEN_SCHEMA)) {
    // An older brand keeps what it had: its pace is its motion axis, and its focus ring stays the primary color.
    if (tokens.pace === undefined && (tokens.motion === "calm" || tokens.motion === "snappy")) tokens.pace = tokens.motion
    if (tokens.focus === undefined) tokens.focus = "primary"
  }
  return { ok: true, tokens, from }
}
