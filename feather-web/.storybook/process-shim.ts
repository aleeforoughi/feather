// apply-brand.mjs is a Node script that also runs in the browser here; give it the one global it probes.
const g = globalThis as { process?: { argv: string[] } }
g.process ??= { argv: [] }
export {}
