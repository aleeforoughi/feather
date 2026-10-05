import { SearchIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Icon, Input } from "@aleeforoughi/feather-react"
import type { SearchEntry } from "../plugins/docs-source"
import { search } from "./search-index"

const KIND_LABEL: Record<SearchEntry["kind"], string> = { page: "Page", heading: "Section", node: "Node", schema: "Schema" }

/** The search box: results appear under it as links, and the arrow keys move through them. */
export function Search({ entries, root }: { entries: SearchEntry[]; root: string }) {
  const [query, setQuery] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const results = useMemo(() => search(entries, query), [entries, query])

  // "/" jumps to the search box, as on most documentation sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !target.isContentEditable) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const links = () => Array.from(list.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])
  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      links()[0]?.focus()
    } else if (e.key === "Escape") setQuery("")
  }
  const onListKey = (e: React.KeyboardEvent) => {
    const all = links()
    const i = all.indexOf(document.activeElement as HTMLAnchorElement)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      all[Math.min(i + 1, all.length - 1)]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (i <= 0) input.current?.focus()
      else all[i - 1]?.focus()
    } else if (e.key === "Escape") {
      setQuery("")
      input.current?.focus()
    }
  }

  return (
    <div role="search" data-slot="docs-search" className="relative w-full max-w-md">
      <Icon icon={SearchIcon} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-secondary" />
      <Input
        ref={input}
        type="search"
        aria-label="Search the docs"
        placeholder="Search headings and node names"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onInputKey}
        className="pl-10"
      />
      <p role="status" className="sr-only">
        {query.trim() ? `${results.length} ${results.length === 1 ? "result" : "results"}` : ""}
      </p>
      {query.trim() !== "" && (
        <div data-slot="docs-search-results" className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-card border border-line-primary bg-surface-raised p-2 shadow-2">
          {results.length === 0 ? (
            <p className="type-body-sm p-2 text-fg-secondary">Nothing matches that.</p>
          ) : (
            <ul ref={list} onKeyDown={onListKey} className="flex flex-col">
              {results.map((r) => (
                <li key={`${r.href}-${r.text}-${r.kind}`}>
                  <a href={`${root}${r.href}`} onClick={() => setQuery("")} className="flex flex-col rounded-control p-2 hover:bg-surface-hover">
                    <span className="type-label text-fg-primary">{r.text}</span>
                    <span className="type-caption text-fg-secondary">
                      {KIND_LABEL[r.kind]} in {r.pageTitle}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
