// The JSON Schema of feather.page/0, built from spec.ts (for editors and other languages). The validator stays the
// authority: it also checks references, scenes and the honesty floor, which a schema cannot.
import { ANCHORS, BLOCKS, EDGES, ROUTE_VARIANTS, SPEAKER_KINDS, type FieldSpec, type Fields } from "../src/core/spec.ts"

type Json = Record<string, unknown>

function field(spec: FieldSpec): Json {
  switch (spec.kind) {
    case "text":
      return { type: "string", ...(spec.max ? { maxLength: spec.max } : {}) }
    case "number":
      return { type: "number" }
    case "boolean":
      return { type: "boolean" }
    case "enum":
      return { enum: [...spec.values] }
    case "href":
      return { type: "string", not: { pattern: "^\\s*(javascript|data|vbscript):" } }
    case "media":
      return { $ref: "#/$defs/media" }
    case "texts":
      return { type: "array", items: { type: "string" }, ...(spec.min !== undefined ? { minItems: spec.min } : {}), ...(spec.max !== undefined ? { maxItems: spec.max } : {}) }
    case "list":
    case "refs": {
      const item = object(spec.of)
      return { type: "array", items: spec.kind === "refs" ? { anyOf: [{ type: "string" }, item] } : item, ...(spec.min !== undefined ? { minItems: spec.min } : {}), ...(spec.max !== undefined ? { maxItems: spec.max } : {}) }
    }
  }
}

function object(fields: Fields, extra: Json = {}, required: string[] = []): Json {
  const req = [...required, ...Object.entries(fields).filter(([, f]) => f.required).map(([k]) => k)]
  return { type: "object", additionalProperties: false, properties: { ...extra, ...Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, field(f)])) }, ...(req.length ? { required: req } : {}) }
}

/** The JSON Schema of one version: 0 (the sections, scenes and living layer) or 1 (also the page edges). */
export function pageJsonSchema(version: 0 | 1 = 1): Json {
  const blocks = Object.entries(BLOCKS).map(([name, { fields, doc }]) => ({
    description: doc,
    ...object({ title: { kind: "text", max: 160 }, ...fields }, { block: { const: name }, id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" } }, ["block"]),
  }))
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://github.com/aleeforoughi/feather/schema/feather.page-${version}.json`,
    title: `A Feather page (feather.page/${version})`,
    description: "A website as data: one document renders a complete, themeable site; changing brand restyles all of it. Generated from packages/page/src/core/spec.ts by scripts/generate.ts; validatePage is the authority.",
    type: "object",
    additionalProperties: false,
    required: ["schema", "brand", "sections"],
    properties: {
      schema: { const: `feather.page/${version}` },
      brand: { anyOf: [{ type: "string" }, { type: "object" }] },
      title: { type: "string" },
      description: { type: "string" },
      lang: { type: "string" },
      speaker: { type: "object", additionalProperties: false, required: ["kind", "name"], properties: { kind: { enum: [...SPEAKER_KINDS] }, name: { type: "string" }, voice: { type: "string" } } },
      library: { type: "object", properties: { work: { type: "object", additionalProperties: object(Object.fromEntries(Object.entries((BLOCKS.work.fields.items as { of: Fields }).of).filter(([k]) => k !== "id"))) } } },
      sections: { type: "array", minItems: 1, maxItems: 40, items: { $ref: "#/$defs/block" } },
      scenes: {
        type: "object",
        propertyNames: { pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        additionalProperties: { type: "object", additionalProperties: false, required: ["ask", "line", "blocks"], properties: { ask: { type: "string" }, line: { type: "string" }, blocks: { type: "array", minItems: 1, maxItems: 3, items: { $ref: "#/$defs/block" } }, asks: { type: "array", maxItems: 3, items: { type: "string" } } } },
      },
      living: { type: "object", additionalProperties: false, properties: { anchor: { enum: [...ANCHORS] }, fold: { type: "boolean" }, prepared: { type: "array", items: { type: "string" } }, disclosure: { type: "string" } } },
      ...(version === 1 ? { ...Object.fromEntries(Object.entries(EDGES).map(([k, { fields, doc }]) => [k, { description: doc, ...object(fields) }])), transition: { enum: [...ROUTE_VARIANTS] } } : {}),
    },
    $defs: {
      media: {
        anyOf: [
          { type: "string" },
          { type: "object", required: ["src"], additionalProperties: false, properties: { src: { type: "string" }, alt: { type: "string" }, poster: { type: "string" }, decorative: { type: "boolean" }, sources: { type: "array", items: { type: "object", required: ["src", "type"], properties: { src: { type: "string" }, type: { type: "string" } } } } } },
        ],
      },
      block: { oneOf: blocks },
    },
  }
}
