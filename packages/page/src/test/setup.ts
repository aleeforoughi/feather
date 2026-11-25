// jsdom lacks a few browser APIs Feather's components touch; stub them so tests see real behavior, not missing APIs.
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => cleanup())

if (!("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
  })
}
if (!("ResizeObserver" in window)) {
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: class { observe() {} unobserve() {} disconnect() {} } })
}
if (!("getAnimations" in Element.prototype)) {
  Object.defineProperty(Element.prototype, "getAnimations", { writable: true, value: () => [] })
}
// jsdom has no canvas: say so quietly (null, as a browser without WebGL does), so the World keeps its still.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { writable: true, value: () => null })
