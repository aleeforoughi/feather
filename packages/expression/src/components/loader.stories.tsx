import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Loader } from "./loader"

const slow = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const Page = ({ header = false }: { header?: boolean }) => (
  <div data-slot="story-page" className="min-h-screen bg-surface-base text-fg-primary">
    <header data-loader-dock={header ? "" : undefined} className="flex h-16 items-center justify-between border-b border-line-primary px-6">
      <span className="type-title">Studio of One</span>
      <nav className="flex gap-6 type-label text-fg-secondary">
        <a href="#work" className="focus-ring">Work</a>
        <a href="#studio" className="focus-ring">Studio</a>
        <a href="#contact" className="focus-ring">Contact</a>
      </nav>
    </header>
    <main className="flex flex-col gap-6 px-6 py-24">
      <h1 className="type-display-l">Furniture for rooms that listen.</h1>
      <p className="max-w-prose type-body text-fg-secondary">One studio, one bench, a catalogue of eleven pieces made to be kept.</p>
    </main>
  </div>
)

const Replay = ({ children }: { children: (key: number) => React.ReactNode }) => {
  const [key, setKey] = React.useState(0)
  return (
    <>
      {children(key)}
      <button type="button" data-slot="story-replay" className="fixed bottom-4 right-4 z-[60] min-h-12 rounded-control border border-line-primary bg-surface-raised px-4 type-label text-fg-primary focus-ring" onClick={() => setKey((k) => k + 1)}>
        Replay
      </button>
    </>
  )
}

const meta = {
  title: "Website/Loader",
  component: Loader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Loader shows how much is really ready, never more, then leaves in one move. Counter is a full-screen percentage that lifts away with a curved wipe; dock is a thin bar that travels into the header marked data-loader-dock. It is in the server HTML, hidden without script and under reduced motion, keeps the page inert and still while it shows, and can ask about sound at the end (muted first).",
      },
    },
  },
  args: { label: "Loading Studio of One" },
} satisfies Meta<typeof Loader>

export default meta
type Story = StoryObj<typeof meta>

export const Counter: Story = {
  render: (args) => (
    <Replay>
      {(key) => (
        <>
          <Page />
          <Loader key={key} {...args} />
        </>
      )}
    </Replay>
  ),
}

export const SlowTask: Story = {
  render: (args) => (
    <Replay>
      {(key) => (
        <>
          <Page />
          <Loader key={key} {...args} tasks={[slow(3500)]} />
        </>
      )}
    </Replay>
  ),
}

export const WithSound: Story = {
  render: (args) => (
    <Replay>
      {(key) => (
        <>
          <Page />
          <Loader key={key} {...args} sound />
        </>
      )}
    </Replay>
  ),
}

export const Dock: Story = {
  render: (args) => (
    <Replay>
      {(key) => (
        <>
          <Page header />
          <Loader key={key} {...args} variant="dock" />
        </>
      )}
    </Replay>
  ),
}

export const DockWithSound: Story = {
  render: (args) => (
    <Replay>
      {(key) => (
        <>
          <Page header />
          <Loader key={key} {...args} variant="dock" sound tasks={[slow(2500)]} />
        </>
      )}
    </Replay>
  ),
}

export const ReducedMotion: Story = {
  render: (args) => (
    <div data-motion="reduced">
      <Page />
      <Loader {...args} />
    </div>
  ),
}
