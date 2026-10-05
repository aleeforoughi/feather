// Receiving replies: what the person did, sent back from the page as { experience, node, act, value? }.
// Never act on a reply without checking it; the browser checked it once, the server is where it counts.
import { validateReply, type Experience, type ReplyEvent, type ReplyResult } from "@aleeforoughi/feather-intent"

/**
 * Checks a reply against the experience it answers. `body` is what arrived: an already-parsed value, or the JSON text
 * (which is parsed here; text that is not JSON gives a `not-an-object` issue). Returns `validateReply`'s result:
 * `{ ok: true, reply }` or `{ ok: false, issues }`. Never throws.
 */
export function parseReply(experience: Experience, body: unknown | string): ReplyResult {
  let input = body
  if (typeof body === "string") {
    try {
      input = JSON.parse(body)
    } catch {
      return { ok: false, issues: [{ code: "not-an-object", message: "A reply is a JSON object: { experience, node, act, value? }; this is not valid JSON." }] }
    }
  }
  return validateReply(experience, input)
}

export interface ReplyHandlerOptions {
  /** The experience replies answer right now, or `undefined` when there is none (answered 404). Called per request. */
  experience: () => Experience | undefined | Promise<Experience | undefined>
  /** Called with each valid reply, before the answer is sent. If it throws, the answer is 500 and nothing is leaked. */
  onReply: (reply: ReplyEvent) => void | Promise<void>
  /** The largest body accepted, in bytes. Default 1 MiB (answered 413). */
  maxBytes?: number
}

/** The parts of Node's `http.IncomingMessage` this uses; Express, Fastify and plain `http` all fit. */
export interface NodeRequestLike {
  method?: string
  /** Set by body-parsing middleware; when present, the stream is not read. */
  body?: unknown
  [Symbol.asyncIterator](): AsyncIterator<unknown>
}
/** The parts of Node's `http.ServerResponse` this uses. */
export interface NodeResponseLike {
  statusCode: number
  setHeader(name: string, value: string): unknown
  end(body?: string): unknown
}

/**
 * One function for both worlds. Give it a Fetch `Request` and it returns a `Response`; give it Node's request and
 * response and it writes the answer to the response (and resolves to `undefined`).
 */
export interface ReplyHandler {
  (request: Request): Promise<Response>
  (request: NodeRequestLike, response: NodeResponseLike): Promise<void>
}

/**
 * A tiny, framework-free handler for the reply endpoint. It answers
 *
 * - 200 `{ ok: true }` after `onReply` took a valid reply;
 * - 400 `{ ok: false, issues }` for a reply that is not valid for the experience (or not JSON);
 * - 404 when `experience()` has none; 405 unless the method is POST; 413 when the body is too large;
 * - 409 when the experience is resolved (`issues[0].code` is `"resolved"`): it takes no more replies;
 * - 500 when the experience itself is invalid or `onReply` throws.
 *
 * Detection: a Fetch `Request` (it has `headers.get`) gets a `Response`; anything else is Node's request, with the
 * response as the second argument. It stores and logs nothing; the reply (which names a node and an act, and may carry
 * what the person typed) goes only to `onReply`.
 *
 * ```ts
 * const handler = createReplyHandler({ experience: () => current, onReply: (reply) => decide(reply) })
 * http.createServer((req, res) => handler(req, res))        // Node
 * export const POST = (request: Request) => handler(request) // Fetch: Next.js, Hono, Deno, Bun, Workers
 * ```
 */
export function createReplyHandler(options: ReplyHandlerOptions): ReplyHandler {
  const limit = options.maxBytes ?? 1024 * 1024

  async function answer(method: string | undefined, read: () => Promise<string | unknown>): Promise<{ status: number; body: unknown }> {
    const fail = (status: number, code: string, message: string) => ({ status, body: { ok: false, issues: [{ code, message }] } })
    if ((method ?? "POST").toUpperCase() !== "POST") return fail(405, "method-not-allowed", "Send the reply with POST.")
    const current = await options.experience()
    if (!current) return fail(404, "no-experience", "There is no open experience to reply to.")
    let raw: string | unknown
    try {
      raw = await read()
    } catch (error) {
      if (error instanceof TooLarge) return fail(413, "too-large", `A reply is at most ${limit} bytes.`)
      return fail(400, "unreadable", "The reply could not be read.")
    }
    const result = parseReply(current, raw)
    if (!result.ok) {
      const code = result.issues[0]?.code
      return { status: code === "resolved" ? 409 : code === "invalid-experience" ? 500 : 400, body: result }
    }
    try {
      await options.onReply(result.reply)
    } catch {
      return { status: 500, body: { ok: false, issues: [{ code: "invalid-experience", message: "The reply could not be handled." }] } }
    }
    return { status: 200, body: { ok: true } }
  }

  async function handler(request: Request | NodeRequestLike, response?: NodeResponseLike): Promise<Response | void> {
    if (isFetchRequest(request)) {
      const { status, body } = await answer(request.method, async () => {
        const text = await request.text()
        if (new TextEncoder().encode(text).length > limit) throw new TooLarge()
        return text
      })
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
    }
    if (!response) throw new TypeError("createReplyHandler: pass the Node response as the second argument.")
    const { status, body } = await answer(request.method, () => readNodeBody(request, limit))
    response.statusCode = status
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify(body))
  }
  return handler as ReplyHandler
}

class TooLarge extends Error {}

function isFetchRequest(request: Request | NodeRequestLike): request is Request {
  const headers = (request as { headers?: { get?: unknown } }).headers
  return typeof headers?.get === "function" && typeof (request as { text?: unknown }).text === "function"
}

async function readNodeBody(request: NodeRequestLike, limit: number): Promise<string | unknown> {
  if (request.body !== undefined) return request.body
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request as AsyncIterable<string | Uint8Array>) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk
    size += bytes.length
    if (size > limit) throw new TooLarge()
    chunks.push(bytes)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    all.set(c, at)
    at += c.length
  }
  return new TextDecoder().decode(all)
}
