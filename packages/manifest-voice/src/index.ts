// @aleeforoughi/feather-manifest-voice: prompts, confirmations and readback for any speech engine, over the dialog
// engine (@aleeforoughi/feather-dialog). Engine-agnostic: the host speaks and listens. No speech engine is bundled.
export { speechFor, sayChoices, spokenNumber, MAX_SPOKEN_WORDS, type Speech } from "./speech.ts"
export { createVoiceDialog, type VoiceDialog } from "./dialog.ts"
export { runVoice, type VoiceEngine, type RunVoiceOptions, type RunVoiceResult } from "./run.ts"
export { spokenToDigits, readbackWord, spokenAnswer } from "./hear.ts"
