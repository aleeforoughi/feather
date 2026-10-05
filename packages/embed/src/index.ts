import "./embed.css"
// @aleeforoughi/feather-embed: Feather in any web page. One script import, no framework, no build step on the page.
//
//   import { mount } from "/static/feather/feather-embed.js"
//   const view = mount(element, experience, { onReply(reply) { ... } })
export { mount, validate, validateReply } from "./mount.tsx"
export { version } from "./version.ts"
export type { FeatherView, MountOptions, ThemeInput } from "./types.ts"
export type { RenderContext } from "@aleeforoughi/feather-context"
export type { Experience, Issue, ReplyEvent, ReplyIssue, UpdateIssue, UpdateIssueCode, UpdateResult } from "@aleeforoughi/feather-intent"
export type { BrandTokens } from "@aleeforoughi/feather-tokens"
