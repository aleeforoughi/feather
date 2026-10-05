// @aleeforoughi/feather-manifest-text: a layout plan as plain text and a conversation in the terminal, over the dialog
// engine (@aleeforoughi/feather-dialog). The feather-text command is in cli.ts.
export { renderTurn, wrap, DEFAULT_WIDTH, type RenderOptions } from "./render.ts"
export { runText, canStyle, type RunTextOptions, type RunTextResult, type TextUpdate } from "./run.ts"
export { parseArgs, USAGE, type Args } from "./args.ts"
