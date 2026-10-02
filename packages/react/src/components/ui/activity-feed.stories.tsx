import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BotIcon, CheckCircle2Icon, HandIcon, XCircleIcon } from "lucide-react"
import { ActivityFeed, ActivityItem, LiveDot, WorkingDots, type ActivityTone } from "./activity-feed"
import { Badge } from "./badge"

type Line = { tone: ActivityTone; text: string; actor?: string }
const LINES: Line[] = [
  { tone: "good", text: "The owner approved the Product Card." },
  { tone: "info", actor: "Brand designer", text: "Reading the ideas, then drafting tokens and two logo directions." },
  { tone: "warn", text: "QA sent the logo back: the mark is too thin at small sizes." },
  { tone: "bad", text: "The build failed: two type errors in the header." },
  { tone: "ask", text: "The design is ready for your approval." },
]
const iconFor = (t: ActivityTone) => (t === "good" ? <CheckCircle2Icon /> : t === "bad" ? <XCircleIcon /> : t === "ask" ? <HandIcon /> : <BotIcon />)

const meta = {
  title: "Molecules/ActivityFeed",
  component: ActivityFeed,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "A live log: newest at the bottom, older lines fading out above, following new lines until the user scrolls up. Tones color each line; the newest can type itself out." } } },
} satisfies Meta<typeof ActivityFeed>

export default meta
type Story = StoryObj<typeof meta>

export const Tones: Story = {
  render: () => (
    <ActivityFeed className="w-[32rem] rounded-xl ring-1 ring-foreground/10">
      {LINES.map((l, i) => (
        <ActivityItem key={i} tone={l.tone} icon={iconFor(l.tone)} time={`10:4${i}`} actor={l.actor && <Badge variant="outline">{l.actor}</Badge>} text={l.text} />
      ))}
    </ActivityFeed>
  ),
}

function Streaming() {
  const [n, setN] = React.useState(1)
  React.useEffect(() => {
    const t = setInterval(() => setN((x) => (x >= LINES.length ? 1 : x + 1)), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="w-[32rem] space-y-3">
      <div className="flex items-center gap-2 text-sm"><LiveDot live /> Live · Brand designer is working <WorkingDots /></div>
      <ActivityFeed followKey={n} className="rounded-xl ring-1 ring-foreground/10">
        {LINES.slice(0, n).map((l, i) => (
          <ActivityItem key={i} tone={l.tone} icon={iconFor(l.tone)} text={l.text} typed={i === n - 1} />
        ))}
      </ActivityFeed>
    </div>
  )
}

export const Live: Story = { render: () => <Streaming /> }

export const Empty: Story = { render: () => <ActivityFeed className="w-[32rem] rounded-xl ring-1 ring-foreground/10" emptyText="Waiting for the first move…" /> }
