// The documents of tmag/http/v2 and the tmag/v2 documents it relays, as far as
// the page reads them. tmux-agent-experience's docs/http-api.md and its wiki's
// Architecture and Contracts page are the source; a field either may omit is
// optional here.

export type State = 'idle' | 'working' | 'blocked'

/** A prompt a session waits on: a permission, a question or a plan. */
export interface Request {
  id: string
  kind: string
  tool?: string
  since?: string
  /** Set when a subagent asks. */
  agent?: string
}

export interface Session {
  id: string
  agent: string
  state: State
  kind?: string
  turn?: string
  since?: string
  cwd?: string
  runtime?: string
  capabilities: string[]
  requests: Request[]
  subagents?: unknown[]
}

export interface Pane {
  server: string
  id: string
  target?: string
  cwd?: string
  command?: string
  agent?: string
  session?: string
  evidence?: string
  view?: string
}

/** A logged change; one with a state reports its session in full. */
export interface Event {
  seq: number
  time: string
  agent: string
  session: string
  event: string
  state?: State
  kind?: string
  turn?: string
  since?: string
  cwd?: string
  runtime?: string
  capabilities?: string[]
  requests?: Request[]
  subagents?: unknown[]
}

export type WatchDoc =
  | { type: 'snapshot'; seq: number; sessions?: Partial<Session>[]; panes?: Pane[] }
  | { type: 'event'; event: Event }
  | { type: 'panes'; panes?: Pane[] }

/** A prompt of a turn; `from` marks one a person did not type. */
export interface Prompt {
  text: string
  from?: string
}

export interface Turn {
  id: string
  prompts: Prompt[]
  reply: string
}

/** `read --turns N --json`. */
export interface TurnsDoc {
  turns: Turn[]
}

/** `read --lines N --json`: the text of the pane that shows the session. */
export interface ScreenDoc {
  text: string
}

/** `request --json`: what a request asks, with the tool's input. */
export interface RequestDoc {
  request: Request
  tool?: string
  input?: Record<string, unknown>
}

/** The credential `POST /v2/pair` issues; the page keeps it. */
export interface Credential {
  id: string
  label: string
  token: string
}

export interface PairDoc {
  credential: Credential & { created?: string; expires?: string }
}

export type Action =
  | { verb: 'send'; target: string; text: string }
  | { verb: 'interrupt'; target: string }
  | {
      verb: 'answer'
      target: string
      request: string
      decision: 'allow' | 'deny'
      message?: string
      answers?: Record<string, string>
    }

/** The error document of tmag/http/v2 and of tmag/v2's refusals. */
export interface ErrorDoc {
  error: { code: string; message: string }
}
