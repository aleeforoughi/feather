import * as React from "react"
import { cn } from "../../lib/cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const container = React.useRef<HTMLDivElement>(null)
  // A table wider than its container scrolls; a keyboard user must be able to reach and scroll it, so the container
  // becomes a focusable, named region only while it overflows (no extra tab stop for a table that fits).
  const [scrolls, setScrolls] = React.useState(false)
  React.useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1)
    check()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(check)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={container}
      data-slot="table-container"
      data-variant={scrolls ? "scrolls" : "fits"}
      {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": "Table, scrolls sideways" } : {})}
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-separate border-spacing-0 type-body-sm text-fg-primary", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr>*]:border-b-line-secondary", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child>*]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-surface-subtle font-medium [&>tr>*]:border-t [&>tr>*]:border-t-line-secondary [&>tr:last-child>*]:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "motion-state *:border-b *:border-line-tertiary hover:bg-surface-hover has-aria-expanded:bg-surface-hover data-[state=selected]:bg-surface-selected",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-control py-control text-left align-middle type-label whitespace-nowrap text-fg-primary [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-control py-control align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 type-body-sm text-fg-secondary", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
