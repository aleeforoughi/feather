import { MenuIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button, Icon, Separator } from "@aleeforoughi/feather-react"
import docs from "virtual:docs"
import type { DocPage } from "../plugins/docs-source"
import { LiveExample } from "./LiveExample"
import { Search } from "./Search"

const ROOT_TOKEN = "@@ROOT@@"

/** Which page the URL names: its last folder, so the site works from any base path. */
function currentPage(): DocPage {
  const last = location.pathname.split("/").filter(Boolean).pop()?.replace(/\.html$/, "")
  return docs.pages.find((p) => p.slug && p.slug === last) ?? docs.pages[0]!
}

export default function App() {
  const page = useMemo(() => currentPage(), [])
  // A nested page is one folder below the site root.
  const root = page.slug ? "../" : "./"
  const [menu, setMenu] = useState(false)
  const [notice, setNotice] = useState("")
  const article = useRef<HTMLElement>(null)
  const html = useMemo(() => page.html.split(ROOT_TOKEN).join(root), [page, root])

  useEffect(() => {
    document.title = `${page.title} | Feather docs`
  }, [page])

  // A hash in the URL scrolls to its heading (the content arrives after the browser has already tried).
  useEffect(() => {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
  }, [])

  // Copy buttons on code blocks (event delegation: the blocks are rendered markdown).
  useEffect(() => {
    const el = article.current
    if (!el) return
    const onClick = async (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-copy]")
      if (!button) return
      const code = button.parentElement?.querySelector("pre")?.textContent ?? ""
      try {
        await navigator.clipboard.writeText(code)
        button.textContent = "Copied"
        setNotice("Copied to the clipboard")
      } catch {
        button.textContent = "Press Ctrl+C"
        setNotice("Copying is not available here; select the code and copy it")
      }
      window.setTimeout(() => {
        button.textContent = "Copy"
        setNotice("")
      }, 2000)
    }
    el.addEventListener("click", onClick)
    return () => el.removeEventListener("click", onClick)
  }, [])

  return (
    <div data-slot="docs-app" className="min-h-screen bg-surface-base text-fg-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:rounded-control focus:bg-surface-raised focus:p-3 focus:type-label">
        Skip to content
      </a>

      <header className="sticky top-0 z-10 border-b border-line-secondary bg-surface-base">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-container py-3">
          <Button variant="outline" size="icon" className="lg:hidden" aria-expanded={menu} aria-controls="docs-nav" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu(!menu)}>
            <Icon icon={menu ? XIcon : MenuIcon} />
          </Button>
          <a href={root} className="type-title shrink-0 text-fg-primary">
            Feather <span className="text-fg-secondary">docs</span>
          </a>
          <div className="flex flex-1 justify-end">
            <Search entries={docs.search} root={root} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-container py-6 lg:flex-row lg:gap-8">
        <nav id="docs-nav" aria-label="Docs" data-open={menu} className={`${menu ? "block" : "hidden"} lg:block lg:w-1/5 lg:shrink-0`}>
          <ul className="flex flex-col gap-1 lg:sticky lg:top-24">
            {docs.pages.map((p) => (
              <li key={p.slug}>
                <a
                  href={`${root}${p.route}`}
                  aria-current={p.slug === page.slug ? "page" : undefined}
                  className="type-label flex min-h-control flex-col justify-center rounded-control px-3 py-1 text-fg-secondary hover:bg-surface-hover hover:text-fg-primary aria-[current=page]:bg-surface-selected aria-[current=page]:text-fg-primary"
                >
                  <span>{p.nav}</span>
                  <span className="type-caption text-fg-secondary">{p.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1">
          {page.slug === "schemas" ? (
            <Schemas root={root} />
          ) : (
            <>
              <details className="mb-6 rounded-card border border-line-secondary p-3 xl:hidden">
                <summary className="type-label cursor-pointer text-fg-primary">On this page</summary>
                <Toc page={page} label="On this page, short" />
              </details>
              <article ref={article} className="prose" data-slot="docs-article" dangerouslySetInnerHTML={{ __html: html }} />
              {page.slug === "" && <LiveExample />}
            </>
          )}
          <p role="status" className="sr-only">
            {notice}
          </p>
        </main>

        {page.slug !== "schemas" && page.toc.length > 0 && (
          <aside aria-label="Page contents" className="hidden xl:block xl:w-1/5 xl:shrink-0">
            <div className="sticky top-24">
              <p className="type-caps mb-2 text-fg-secondary">On this page</p>
              <Toc page={page} label="On this page" />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function Toc({ page, label }: { page: DocPage; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-1 pt-2">
        {page.toc.map((h) => (
          <li key={h.id} className={h.depth === 3 ? "pl-4" : ""}>
            <a href={`#${h.id}`} className="type-body-sm block rounded-control py-1 text-fg-secondary hover:text-fg-primary">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Schemas({ root }: { root: string }) {
  return (
    <div className="prose" data-slot="docs-schemas">
      <h1 id="json-schemas">JSON Schemas</h1>
      <p>
        The machine-readable contracts, generated from the IR&apos;s single table of node types. Validate with them in any language, or use the
        validators in the SDK, which agree with them case for case.
      </p>
      <Separator />
      <ul className="schema-list">
        {docs.schemas.map((s) => (
          <li key={s.file}>
            <p className="type-title">{s.title}</p>
            <p className="type-body-sm text-fg-secondary">
              <code>{s.file}</code>, {(s.bytes / 1024).toFixed(1)} KB, <code>{s.id}</code>
            </p>
            <p>
              <a href={`${root}schema/${s.file}`} download={s.file}>
                Download {s.file}
              </a>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
