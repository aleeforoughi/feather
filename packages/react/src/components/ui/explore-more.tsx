"use client"

import { ChevronDownIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

type ExploreMoreProps = {
  intent: string
  /** The words for it; defaults to the intent. */
  label?: string
  /** What more is available. */
  topics?: string[]
  onAct: (act: "expand", topic?: string) => void
  className?: string
}

/** The words on the button: with topics, the label or "More about…"; without, the label or the intent. */
function exploreMoreLabel({ intent, label, topics }: Pick<ExploreMoreProps, "intent" | "label" | "topics">): string {
  const given = label?.trim()
  if ((topics?.length ?? 0) > 0) return given || "More about…"
  return given || intent
}

/**
 * More on request. With no topics, one button asks for more. With topics, a "More about…" menu lists them;
 * each topic asks for more about it. Escape closes the menu and returns focus to the button.
 */
function ExploreMore({ intent, label, topics, onAct, className }: ExploreMoreProps) {
  const text = exploreMoreLabel({ intent, label, topics })
  const hasTopics = (topics?.length ?? 0) > 0
  return (
    <div data-slot="explore-more" data-variant={hasTopics ? "topics" : "single"} data-intent={intent} className={cn("inline-flex", className)}>
      {hasTopics ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-slot="explore-more-trigger"
            render={<Button variant="outline" className="h-auto min-h-8 max-w-full whitespace-normal py-1 text-left" />}
          >
            {text}
            <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent data-slot="explore-more-menu" align="start" className="w-auto min-w-48 max-w-[min(24rem,90vw)]">
            {topics!.map((topic) => (
              <DropdownMenuItem key={topic} data-slot="explore-more-topic" className="whitespace-normal break-words" onClick={() => onAct("expand", topic)}>
                {topic}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          type="button"
          variant="outline"
          data-slot="explore-more-button"
          className="h-auto min-h-8 max-w-full whitespace-normal py-1 text-left"
          onClick={() => onAct("expand")}
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {text}
        </Button>
      )}
    </div>
  )
}

export { ExploreMore, exploreMoreLabel }
export type { ExploreMoreProps }
