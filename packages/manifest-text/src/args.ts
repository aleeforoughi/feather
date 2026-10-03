// The feather-text command line: feather-text <experience.json> [--context <context.json>] [--width N]

export interface Args {
  file: string
  context?: string
  width?: number
}

export const USAGE = `Usage: feather-text <experience.json> [--context <context.json>] [--width N]

Composes the experience (feather.ir/0) and talks it through in the terminal.
  The conversation goes to stderr; every reply goes to stdout as one JSON line.
  An invalid experience prints its problems and exits 1.

Options:
  --context <file>  a render context (JSON). Default: { "device": { "surface": "terminal" } }
  --width N         wrap lines at N characters (20 to 400). Default 80
  -h, --help        this text
`

/** Reads the arguments; a string is the problem, for the caller to print with the usage. */
export function parseArgs(argv: string[]): Args | { help: true } | string {
  let file: string | undefined
  let context: string | undefined
  let width: number | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined]
    if (flag === "-h" || flag === "--help") return { help: true }
    if (flag === "--context" || flag === "--width") {
      const value = inline ?? argv[++i]
      if (value === undefined || value === "") return `${flag} needs a value.`
      if (flag === "--context") context = value
      else {
        if (!/^\d+$/.test(value) || Number(value) < 20 || Number(value) > 400) return "--width is a whole number from 20 to 400."
        width = Number(value)
      }
    } else if (arg.startsWith("-") && arg !== "-") return `Unknown option ${arg}.`
    else if (file === undefined) file = arg
    else return `Unexpected argument ${arg}.`
  }
  if (file === undefined) return "Give the experience file to run."
  return { file, ...(context === undefined ? {} : { context }), ...(width === undefined ? {} : { width }) }
}
