import * as React from "react"
import { Section } from "@aleeforoughi/feather-expression"
import { quizResult, quizScore, type QuizSpec } from "../core/flows"
import type { QuizResultSpec } from "../core/types"
import { Choice, useFocusOnChange } from "./controls"
import { KnobBody, KnobTitle, alignClass, useKnobs } from "./knobs"
import { BUTTON_PRIMARY, BUTTON_QUIET, join, useRegion, type BlockProps } from "./shared"

/** How the result is decided, in words: the static form says it, and the result repeats it for the person's answers. */
function rules(quiz: QuizSpec): string {
  const matches = quiz.results.some((r) => r.match && Object.keys(r.match).length)
  const first = matches ? "Some combinations of answers lead straight to a result. Otherwise, " : ""
  if ((quiz.scoring ?? "tally") === "score") return `${first}${matches ? "each" : "Each"} answer carries points, and the total picks the result.`
  return `${first}${matches ? "each" : "Each"} answer points to a result, and the one most of your answers point to is yours (a tie goes to the one listed first).`
}

const range = (r: QuizResultSpec) => (r.min !== undefined && r.max !== undefined ? `${r.min} to ${r.max}` : r.min !== undefined ? `${r.min} or more` : r.max !== undefined ? `${r.max} or less` : null)

/** Why this result, for these answers. */
function because(quiz: QuizSpec, r: QuizResultSpec, answers: Record<string, string>): string {
  if (r.match && Object.entries(r.match).every(([q, o]) => answers[q] === o) && Object.keys(r.match).length) return "This combination of answers leads here."
  if ((quiz.scoring ?? "tally") === "score") return `Your answers added up to ${quizScore(quiz, answers)}${range(r) ? ` (${range(r)} gives this result)` : ""}.`
  const n = quiz.questions.filter((q) => q.options.find((o) => o.id === answers[q.id])?.result === r.id).length
  return `${n} of your ${quiz.questions.length} answers pointed here.`
}

/**
 * A quiz (feather.page/1, wave 5): one question per step as a native radio group, a back control, a result keyed by
 * the answers and a way to start again. Nothing advances on its own: the person chooses, then goes on. With no
 * script, every question shows at once and "How the result is decided" lists every result and its rule.
 */
export function QuizBlock({ block }: BlockProps<"quiz">) {
  const { id, titleId, labelled } = useRegion(block, "Quiz")
  const knobs = useKnobs<"steps">("quiz", block, { space: "l" })
  const base = id ?? titleId.replace(/-title$/, "")
  const quiz: QuizSpec = block
  const n = block.questions.length
  const [step, setStep] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [done, setDone] = React.useState(false)
  const [nudge, setNudge] = React.useState(false)
  const focus = useFocusOnChange(done ? "result" : step)
  const result = done ? quizResult(quiz, answers) : null
  const current = block.questions[step]

  const next = () => {
    if (!answers[current.id]) {
      setNudge(true)
      document.querySelector<HTMLInputElement>(`input[name="${base}-${current.id}"]`)?.focus()
      return
    }
    setNudge(false)
    if (step < n - 1) setStep(step + 1)
    else setDone(true)
  }
  const back = () => {
    setNudge(false)
    if (done) setDone(false)
    else setStep(Math.max(0, step - 1))
  }
  const restart = () => {
    setAnswers({})
    setNudge(false)
    setDone(false)
    setStep(0)
  }
  return (
    <Section id={id} data-block="quiz" {...labelled} {...knobs.section}>
      <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
        {block.title}
      </KnobTitle>
      <KnobBody knobs={knobs}>
        <div data-slot="quiz" className={join(alignClass(knobs.align, "col-span-full"), "flex w-full max-w-3xl flex-col gap-8 text-start")}>
          {block.body ? (
            <p data-slot="quiz-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
              {block.body}
            </p>
          ) : null}
          <form data-slot="quiz-form" className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
            <div data-slot="quiz-progress" className="flex flex-col gap-2 noscript:hidden">
              <p data-slot="quiz-progress-text" aria-hidden="true" className="type-caps numeric text-fg-secondary">
                {done ? "Your result" : `Question ${step + 1} of ${n}`}
              </p>
              <div data-slot="quiz-progress-track" aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-surface-raised">
                <div data-slot="quiz-progress-bar" className="h-full origin-left bg-primary motion-state" style={{ transform: `scaleX(${done ? 1 : (step + 1) / (n + 1)})` }} />
              </div>
            </div>
            {block.questions.map((q, i) => {
              const shown = !done && i === step
              return (
                <fieldset key={q.id} data-slot="quiz-question" data-state={shown ? "current" : "hidden"} className="flex flex-col gap-3 scripting:data-[state=hidden]:hidden">
                  <legend data-slot="quiz-legend" className="mb-4 flex flex-col gap-2">
                    <span data-slot="quiz-count" className="type-caps numeric text-fg-secondary scripting:sr-only">{`Question ${i + 1} of ${n}`}</span>
                    <h3 ref={shown ? (focus as React.Ref<HTMLHeadingElement>) : undefined} tabIndex={-1} data-slot="quiz-q" className="type-heading-2 text-fg-primary focus-ring">
                      {q.q}
                    </h3>
                    {q.help ? (
                      <span data-slot="quiz-help" className="type-body text-fg-secondary">
                        {q.help}
                      </span>
                    ) : null}
                  </legend>
                  {q.options.map((o) => (
                    <Choice key={o.id} slot="quiz-option" name={`${base}-${q.id}`} value={o.id} checked={answers[q.id] === o.id} onChange={(v) => { setAnswers((a) => ({ ...a, [q.id]: v })); setNudge(false) }}>
                      {o.label}
                    </Choice>
                  ))}
                </fieldset>
              )
            })}
            <div data-slot="quiz-result" data-state={done ? "shown" : "hidden"} className="hidden flex-col gap-4 rounded-card border border-line-primary bg-surface-raised p-6 data-[state=shown]:flex">
              {done ? (
                result ? (
                  <>
                    <h3 ref={focus as React.Ref<HTMLHeadingElement>} tabIndex={-1} data-slot="quiz-result-title" className="type-heading-1 text-fg-primary focus-ring">
                      {result.title}
                    </h3>
                    {result.body ? (
                      <p data-slot="quiz-result-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
                        {result.body}
                      </p>
                    ) : null}
                    <p data-slot="quiz-result-why" className="type-caption text-fg-secondary">
                      {because(quiz, result, answers)}
                    </p>
                    {result.href ? (
                      <a href={result.href} data-slot="quiz-result-link" className={join(BUTTON_PRIMARY, "self-start")}>
                        {result.label ?? "Go on"}
                      </a>
                    ) : null}
                  </>
                ) : (
                  <h3 ref={focus as React.Ref<HTMLHeadingElement>} tabIndex={-1} data-slot="quiz-result-title" className="type-heading-2 text-fg-primary focus-ring">
                    No result fits these answers. Try again with different ones.
                  </h3>
                )
              ) : null}
            </div>
            <p data-slot="quiz-nudge" aria-live="polite" className="type-body text-fg-primary noscript:hidden">
              {nudge ? "Choose an answer to go on." : ""}
            </p>
            <div data-slot="quiz-actions" className="flex flex-wrap gap-3 noscript:hidden">
              {done ? (
                <>
                  {/* One filled action per section: a result's own link leads, and Start again is quiet beside it. */}
                  <button type="button" data-slot="quiz-restart" onClick={restart} className={result?.href ? BUTTON_QUIET : BUTTON_PRIMARY}>
                    Start again
                  </button>
                  <button type="button" data-slot="quiz-back" onClick={back} className={BUTTON_QUIET}>
                    Back
                  </button>
                </>
              ) : (
                <>
                  <button type="button" data-slot="quiz-next" onClick={next} className={BUTTON_PRIMARY}>
                    {step < n - 1 ? "Next" : "See my result"}
                  </button>
                  {step > 0 ? (
                    <button type="button" data-slot="quiz-back" onClick={back} className={BUTTON_QUIET}>
                      Back
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </form>
          <details data-slot="quiz-rules" className="border-t border-line-primary pt-4">
            <summary data-slot="quiz-rules-summary" className="flex min-h-12 cursor-pointer items-center type-title text-fg-primary focus-ring">
              How the result is decided
            </summary>
            <div data-slot="quiz-rules-body" className="flex flex-col gap-4 pt-2">
              <p data-slot="quiz-rules-text" className="max-w-prose type-body text-prose text-fg-secondary">
                {rules(quiz)}
              </p>
              <ul data-slot="quiz-rules-list" role="list" className="flex flex-col gap-3">
                {block.results.map((r) => (
                  <li key={r.id} data-slot="quiz-rules-item" className="flex flex-col gap-1">
                    <p data-slot="quiz-rules-name" className="type-label text-fg-primary">
                      {r.title}
                    </p>
                    <p data-slot="quiz-rules-when" className="type-body-sm text-fg-secondary">
                      {ruleFor(quiz, r)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </KnobBody>
    </Section>
  )
}

/** When one result is given, in words. */
function ruleFor(quiz: QuizSpec, r: QuizResultSpec): string {
  const parts: string[] = []
  if (r.match && Object.keys(r.match).length) {
    const picks = Object.entries(r.match).map(([qid, oid]) => {
      const q = quiz.questions.find((x) => x.id === qid)
      return `“${q?.options.find((o) => o.id === oid)?.label ?? oid}”`
    })
    parts.push(`When you answer ${picks.join(" and ")}.`)
  }
  if ((quiz.scoring ?? "tally") === "score") {
    const span = range(r)
    if (span) parts.push(`${parts.length ? "Otherwise, a" : "A"} total of ${span}.`)
  } else {
    const n = quiz.questions.reduce((sum, q) => sum + q.options.filter((o) => o.result === r.id).length, 0)
    parts.push(`${parts.length ? "Otherwise, w" : "W"}hen most of your answers point here (${n} answer${n === 1 ? "" : "s"} do).`)
  }
  return parts.join(" ")
}
