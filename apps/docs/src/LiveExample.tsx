import { useState } from "react"
import { REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import type { Experience } from "@aleeforoughi/feather-intent"
import { FeatherExperience } from "@aleeforoughi/feather-manifest-web"
import fixture from "../../../conformance/ir/valid/ad-campaign-launch.json"

const experience = fixture.ir as unknown as Experience

/** The canonical campaign launch, rendered by Feather itself for a phone: the same JSON the guide builds. */
export function LiveExample() {
  const [reply, setReply] = useState<string | null>(null)
  return (
    <section aria-labelledby="live-example" data-slot="docs-live-example" className="mt-12 flex flex-col gap-4">
      <div className="prose">
      <h2 id="live-example">Try it</h2>
      <p>
        This is the guide&apos;s experience, rendered by <code>FeatherExperience</code> for the phone reference context. Confirming is a
        deliberate act, and the reply below is exactly what your server would receive.
      </p>
      </div>
      <div className="flex flex-col gap-4 rounded-card border border-line-secondary p-4">
        <FeatherExperience experience={experience} context={REFERENCE_CONTEXTS.phone.context} autoFocus={false} onReply={(r) => setReply(JSON.stringify(r, null, 2))} />
      </div>
      <div role="status">
        {reply !== null && (
          <div className="code-block" data-language="json">
            <pre tabIndex={0}>
              <code>{reply}</code>
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}
