import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Composer } from "./composer"

const speaker = { kind: "person", name: "Alee" } as const

describe("Composer", () => {
  it("shows the disclosure before the first word, linked to the textarea", () => {
    render(<Composer speaker={speaker} onSend={() => {}} />)
    const box = screen.getByRole("textbox", { name: "Ask Alee" })
    const note = screen.getByText(/AI agent answering in Alee's own words/)
    expect(note).toBeTruthy()
    expect(box.getAttribute("aria-describedby")).toBe(note.id)
  })
  it("uses a valid custom disclosure, and warns and falls back on an invalid one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rerender } = render(<Composer speaker={speaker} disclosure="I am an AI agent, trained on Alee's writing." onSend={() => {}} />)
    expect(screen.getByText(/trained on Alee's writing/)).toBeTruthy()
    expect(warn).not.toHaveBeenCalled()
    rerender(<Composer speaker={speaker} disclosure="Ask me anything." onSend={() => {}} />)
    expect(screen.getByText(/AI agent answering/)).toBeTruthy()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
  it("sends on Enter, adds a line on Shift+Enter, and never sends while composing", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<Composer speaker={speaker} onSend={onSend} />)
    const box = screen.getByRole("textbox")
    await user.type(box, "one{Shift>}{Enter}{/Shift}two")
    expect(onSend).not.toHaveBeenCalled()
    expect((box as HTMLTextAreaElement).value).toBe("one\ntwo")
    fireEvent.keyDown(box, { key: "Enter", isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
    await user.type(box, "{Enter}")
    expect(onSend).toHaveBeenCalledWith("one\ntwo")
    expect((box as HTMLTextAreaElement).value).toBe("")
  })
  it("disables Send while empty, and Send becomes Stop in the same element", async () => {
    const onStop = vi.fn()
    const { rerender } = render(<Composer speaker={speaker} onSend={() => {}} onStop={onStop} />)
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    rerender(<Composer speaker={speaker} onSend={() => {}} onStop={onStop} streaming />)
    const stop = screen.getByRole("button", { name: "Stop" }) as HTMLButtonElement
    expect(stop).toBe(send)
    expect(stop.disabled).toBe(false)
    await userEvent.click(stop)
    expect(onStop).toHaveBeenCalledOnce()
  })
  it("sends from the button and from starters", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<Composer speaker={speaker} onSend={onSend} starters={["Show me the work"]} />)
    await user.click(screen.getByRole("button", { name: "Show me the work" }))
    expect(onSend).toHaveBeenCalledWith("Show me the work")
    await user.type(screen.getByRole("textbox"), "hi")
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(onSend).toHaveBeenLastCalledWith("hi")
  })
  it("sets text at 16px (type-body), growing from 40 to 192px", () => {
    render(<Composer speaker={speaker} onSend={() => {}} />)
    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    expect(box.className).toContain("type-body")
    expect(box.className).toContain("min-h-10")
    expect(box.style.maxHeight).toBe("192px")
    expect(box.style.getPropertyValue("field-sizing") || (box.style as unknown as Record<string, string>).fieldSizing).toBe("content")
  })
})
