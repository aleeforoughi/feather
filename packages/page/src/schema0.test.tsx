// A feather.page/0 document renders byte-identical HTML across releases: the knobs and variants of /1 are additive.
// The snapshots were taken before wave 2 added them; a diff here is a regression, never a reason to update them.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { validatePage } from "./core/validate"
import { FeatherPage } from "./render"
import { defaultBlocks } from "./blocks/index"
import { BLOCKS } from "./blocks/fixtures"
import { BLOCK_NAMES } from "./core/spec"
import type { BlockName, PageDocument } from "./core/types"

const themes = path.join(import.meta.dirname, "../../tokens/themes")
const theme = (name: string) => JSON.parse(fs.readFileSync(path.join(themes, `${name}.json`), "utf8")).tokens

/** The reference page as it was before wave 2, as a /0 document (no edges), frozen in src/test. */
function page0(): PageDocument {
  const r = validatePage(JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "test/studio-of-one-0.page.json"), "utf8")))
  if (!r.ok) throw new Error(`invalid /0 page: ${JSON.stringify(r.issues)}`)
  return r.page
}

describe("feather.page/0 renders as it did before the knobs", () => {
  it("the reference page, byte for byte", async () => {
    // The brand's head (its theme CSS, its open-font faces and their preloads) is the tokens' and changes with
    // feather-tokens; the page's own markup is what must hold.
    const html = renderToStaticMarkup(<FeatherPage page={page0()} tokens={theme("studio")} />)
      .replace(/<style data-feather-theme="">[\s\S]*?<\/style>/, "")
      .replace(/<style data-feather-fonts="">[\s\S]*?<\/style>/, "")
      .replace(/<link rel="preload"[^>]*\/>/g, "")
    await expect(html).toMatchFileSnapshot("__snapshots__/studio-of-one.page-0.html")
  })

  // The /0 library: the page blocks are /1's and have no /0 form.
  it.each(BLOCK_NAMES as BlockName[])("the %s block with no knobs, byte for byte", async (kind) => {
    const Block = defaultBlocks[kind] as React.ComponentType<{ block: unknown }>
    const html = renderToStaticMarkup(<Block block={BLOCKS[kind]} />)
    await expect(html).toMatchFileSnapshot(`__snapshots__/block-${kind}-0.html`)
  })
})
