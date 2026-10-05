import http from "node:http"
import type { AddressInfo } from "node:net"
import { describe, expect, it } from "vitest"
import { NODES } from "@aleeforoughi/feather-intent"
import * as client from "../src/index.ts"
import { add, applyUpdate, createReplyHandler, experience, nodes, ops, parseReply, patch, remove, replace, resolve, update, validate, validateReply, type Experience, type ReplyEvent } from "../src/index.ts"

const approve = () =>
  experience("approve", [
    nodes.Text({ id: "t", text: "Spend AED 1,050 on the campaign?" }),
    nodes.Price({ id: "p", amount: 1050, currency: "AED" }),
    nodes.Recommendation({ id: "rec", intent: "approve the spend", summary: "Launch it", primary: true, consequence: { spend: { amount: 1050, currency: "AED" } } }),
    nodes.Action({ id: "no", intent: "decline", label: "Not now" }),
  ], { locale: "en" })

describe("builders", () => {
  it("has one builder per node type", () => {
    for (const spec of NODES) expect(typeof (nodes as Record<string, unknown>)[spec.type], spec.type).toBe("function")
  })
  it("produce IR that validates", () => {
    const doc = approve()
    expect(doc.ir).toBe("feather.ir/1")
    expect(validate(doc)).toMatchObject({ ok: true })
  })
  it("drop fields left undefined, at any depth", () => {
    const node = nodes.Form({ id: "f", intent: "answer", fields: [{ id: "a", prompt: "A?", kind: "text", group: undefined }], importance: undefined })
    expect(node).toEqual({ type: "Form", id: "f", intent: "answer", fields: [{ id: "a", prompt: "A?", kind: "text" }] })
    expect("importance" in node).toBe(false)
  })
  it("leave invalid content to validate()", () => {
    const doc = experience("bad", [nodes.Text({ id: "t", text: "" }), nodes.Text({ id: "t", text: "again" })])
    const result = validate(doc)
    expect(result.ok).toBe(false)
    expect(client.formatIssues(result.ok ? [] : result.issues)).toContain("t")
  })
  it("experience() keeps only the options given", () => {
    expect(Object.keys(experience("x", []))).toEqual(["ir", "experience", "nodes"])
    expect(experience("x", [], { revision: 3, resolved: { outcome: "done", summary: "Done." } })).toMatchObject({ revision: 3, resolved: { outcome: "done" } })
  })
  it("exports the contract", () => {
    expect(client.IR_VERSION).toBe("feather.ir/1")
    expect(client.IR_VERSIONS).toContain("feather.ir/0")
    expect(client.UPDATE_VERSION).toBe("feather.update/1")
    expect(client.UPDATE_VERSIONS).toContain("feather.update/1")
    expect(client.validateReply).toBe(validateReply)
    expect(client.ops.add).toBe(add)
  })
})

describe("a streamed lifecycle", () => {
  it("opens, updates, and resolves", () => {
    let current: Experience = experience("plan_trip", [nodes.Progress({ id: "work", intent: "wait", label: "Searching flights", value: 0.2 })])
    expect(validate(current).ok).toBe(true)

    const step = (changes: ReturnType<typeof ops.add>[]) => {
      const result = applyUpdate(current, update("plan_trip", (current.revision ?? 0) + 1, changes))
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (result.ok) current = result.experience
    }
    step([patch("work", { value: 0.6 })])
    expect(current.revision).toBe(1)
    step([add(nodes.Text({ id: "found", text: "Found one." })), add(nodes.Recommendation({ id: "rec", intent: "take the flight", summary: "Direct, 9:40" }), { after: "found" })])
    step([replace(nodes.Text({ id: "found", text: "Found two." })), remove("work")])
    expect(current.nodes.map((n) => n.id)).toEqual(["found", "rec"])
    step([resolve("done", "Booked: direct flight, 9:40.", { label: "Booking", href: "https://example.com/b/42", kind: "document" })])
    expect(current.resolved).toMatchObject({ outcome: "done", artifact: { label: "Booking" } })
    expect(validate(current).ok).toBe(true)

    // A resolved experience takes no more updates or replies.
    expect(applyUpdate(current, update("plan_trip", 5, [add(nodes.Text({ id: "late", text: "Late." }))])).ok).toBe(false)
    const late = parseReply(current, { experience: "plan_trip", node: "rec", act: "accept" })
    expect(late.ok === false && late.issues[0].code).toBe("resolved")
  })
  it("reports a stale revision", () => {
    const result = applyUpdate(approve(), update("approve", 5, [remove("no")]))
    expect(result.ok === false && result.issues.some((i) => i.code === "stale-revision")).toBe(true)
  })
})

describe("parseReply", () => {
  const doc = approve()
  const body = { experience: "approve", node: "rec", act: "accept" }
  it("accepts a valid reply, as an object or as JSON text", () => {
    expect(parseReply(doc, body)).toEqual({ ok: true, reply: body })
    expect(parseReply(doc, JSON.stringify(body))).toEqual({ ok: true, reply: body })
  })
  it("returns validateReply's result", () => {
    const wrong = { ...body, act: "fly" }
    expect(parseReply(doc, wrong)).toEqual(validateReply(doc, wrong))
    expect(parseReply(doc, wrong).ok).toBe(false)
  })
  it("never throws on text that is not JSON", () => {
    const result = parseReply(doc, "{nope")
    expect(result.ok === false && result.issues[0].code).toBe("not-an-object")
  })
})

describe("createReplyHandler", () => {
  const body = { experience: "approve", node: "rec", act: "accept" }
  const setup = (state: { current: Experience | undefined } = { current: approve() }) => {
    const got: ReplyEvent[] = []
    const handler = createReplyHandler({ experience: () => state.current, onReply: (r) => void got.push(r) })
    return { got, handler, state }
  }
  const post = (handler: ReturnType<typeof setup>["handler"], payload: string, method = "POST") => handler(new Request("http://x.test/api/reply", { method, body: method === "POST" ? payload : undefined }))

  describe("Fetch", () => {
    it("answers 200 on a valid reply and passes it on", async () => {
      const { got, handler } = setup()
      const res = await post(handler, JSON.stringify(body))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(got).toEqual([body])
    })
    it("answers 400 with the issues on an invalid reply", async () => {
      const { got, handler } = setup()
      const res = await post(handler, JSON.stringify({ ...body, act: "fly" }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.issues[0].code).toBe("unknown-act")
      expect((await post(handler, "{nope")).status).toBe(400)
      expect(got).toEqual([])
    })
    it("answers 409 when the experience is resolved", async () => {
      const { got, handler } = setup({ current: approve() })
      const resolved = experience("approve", [], { revision: 2, resolved: { outcome: "done", summary: "Approved." } })
      const res = await post(setup({ current: resolved }).handler, JSON.stringify(body))
      expect(res.status).toBe(409)
      expect((await res.json()).issues[0].code).toBe("resolved")
      expect(got).toEqual([])
      void handler
    })
    it("answers 404, 405 and 413, and 500 when onReply throws", async () => {
      expect((await post(setup({ current: undefined }).handler, JSON.stringify(body))).status).toBe(404)
      expect((await post(setup().handler, "", "GET")).status).toBe(405)
      expect((await post(createReplyHandler({ experience: () => approve(), onReply() {}, maxBytes: 10 }), JSON.stringify(body))).status).toBe(413)
      const boom = createReplyHandler({ experience: () => approve(), onReply() { throw new Error("secret persona data") } })
      const res = await post(boom, JSON.stringify(body))
      expect(res.status).toBe(500)
      expect(JSON.stringify(await res.json())).not.toContain("secret")
    })
  })

  describe("Node http", () => {
    const serve = async (handler: ReturnType<typeof setup>["handler"]) => {
      const server = http.createServer((req, res) => void handler(req, res))
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/reply`
      return { url, close: () => new Promise<void>((r) => server.close(() => r())) }
    }
    it("answers 200, 400 and 409 over a real server", async () => {
      const ok = setup()
      const a = await serve(ok.handler)
      try {
        const good = await fetch(a.url, { method: "POST", body: JSON.stringify(body) })
        expect(good.status).toBe(200)
        expect(good.headers.get("content-type")).toBe("application/json")
        expect(await good.json()).toEqual({ ok: true })
        expect(ok.got).toEqual([body])
        const bad = await fetch(a.url, { method: "POST", body: JSON.stringify({ ...body, node: "ghost" }) })
        expect(bad.status).toBe(400)
        expect((await bad.json()).issues[0].code).toBe("unknown-node")
        expect((await fetch(a.url, { method: "POST", body: "not json" })).status).toBe(400)
        expect((await fetch(a.url)).status).toBe(405)
        expect(ok.got).toHaveLength(1)
      } finally {
        await a.close()
      }
      const resolved = setup({ current: experience("approve", [], { resolved: { outcome: "cancelled", summary: "Stopped." } }) })
      const b = await serve(resolved.handler)
      try {
        expect((await fetch(b.url, { method: "POST", body: JSON.stringify(body) })).status).toBe(409)
      } finally {
        await b.close()
      }
    })
    it("uses a body that middleware already parsed", async () => {
      const { got, handler } = setup()
      const written: { status?: number; body?: string } = {}
      const req = Object.assign((async function* () {})(), { method: "POST", body })
      await handler({ method: "POST", body, [Symbol.asyncIterator]: req[Symbol.asyncIterator] }, { statusCode: 0, setHeader() {}, end(b) { written.body = b } })
      expect(got).toEqual([body])
      expect(written.body).toBe('{"ok":true}')
    })
  })
})
