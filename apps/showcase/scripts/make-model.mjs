#!/usr/bin/env node
// Builds the loud page's product model, public/media/freezon-tag.glb: Freezon's cold-chain tag, made here from Three.js
// primitives and written with GLTFExporter, so the showcase carries no third-party model. A puck-shaped body, a twist
// bezel, a status light and a steel clip, each its own named material: the page's variants recolour them by name, and
// its hotspots point at them in these coordinates (one unit is 30 mm).
//
//   pnpm --filter @feather-apps/showcase model
import fs from "node:fs"
import path from "node:path"
import { BoxGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, TorusGeometry, Vector2 } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"

// GLTFExporter reads its binary through a FileReader, which Node does not have.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
  readAsDataURL(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buffer).toString("base64")}`
      this.onloadend?.()
    })
  }
}

const out = path.join(import.meta.dirname, "../public/media/freezon-tag.glb")

const material = (name, options) => new MeshStandardMaterial({ name, ...options })
const mesh = (name, geometry, mat) => Object.assign(new Mesh(geometry, mat), { name })

const tag = new Group()
tag.name = "freezon-tag"

// The body: a low puck with a soft shoulder, turned on a lathe.
const profile = [
  [0, 0],
  [0.86, 0],
  [0.97, 0.05],
  [1, 0.14],
  [1, 0.36],
  [0.96, 0.46],
  [0.86, 0.52],
  [0, 0.52],
].map(([x, y]) => new Vector2(x, y))
tag.add(mesh("body", new LatheGeometry(profile, 56), material("body", { color: 0x2b3440, roughness: 0.45, metalness: 0.1 })))

// The twist bezel on its top face.
const bezel = mesh("bezel", new TorusGeometry(0.8, 0.055, 12, 72), material("bezel", { color: 0xb8c4cc, roughness: 0.3, metalness: 0.85 }))
bezel.rotation.x = Math.PI / 2
bezel.position.y = 0.53
tag.add(bezel)

// The status light, off-centre toward the front.
const light = mesh("light", new CylinderGeometry(0.13, 0.13, 0.05, 32), material("light", { color: 0x6fd3ff, emissive: 0x1d6f8f, roughness: 0.2 }))
light.position.set(0, 0.55, 0.42)
tag.add(light)

// The steel clip on its back.
const clip = mesh("clip", new BoxGeometry(0.52, 0.34, 0.07), material("clip", { color: 0x9aa4ab, roughness: 0.35, metalness: 0.9 }))
clip.position.set(0, 0.26, -1.03)
tag.add(clip)

const glb = await new GLTFExporter().parseAsync(tag, { binary: true })
fs.writeFileSync(out, Buffer.from(glb))
tag.traverse((node) => {
  node.geometry?.dispose()
  node.material?.dispose()
})
console.log(`wrote ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`)
