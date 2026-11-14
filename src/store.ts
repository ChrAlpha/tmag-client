// What the page knows, as signals the screens read: the credential, the route,
// the view the watch keeps current, and what a session shows (its turns, its
// screen, its requests), read from tmag serve when shown. The page keeps only
// its credential, in this browser's storage, and drafts.

import { batch, computed, effect, type Signal, signal } from '@preact/signals'
import * as api from './api'
import type { Action, Credential, RequestDoc, ScreenDoc, Turn, TurnsDoc } from './contract'
import { apply, empty, sessions, type View } from './view'

const stored = 'tmag.credential'

function saved(): Credential | null {
  try {
    const c = JSON.parse(localStorage.getItem(stored) ?? 'null') as Credential | null
    return c && typeof c.token === 'string' ? c : null
  } catch {
    return null
  }
}

export const credential = signal<Credential | null>(saved())
/** Why the page asks to pair again, if it does. */
export const notice = signal('')

export type Route = { name: 'list' } | { name: 'session'; id: string }

const parse = (hash: string): Route => {
  const id = /^#\/s\/([^/?]+)$/.exec(hash)?.[1]
  return id ? { name: 'session', id: decodeURIComponent(id) } : { name: 'list' }
}

export const route = signal(parse(location.hash))

/** What the watch rebuilt. */
export const view = signal<View>(empty)
/** Whether a snapshot arrived: until then, no session is known to be gone. */
export const loaded = signal(false)
/** Whether the watch delivers. */
export const live = signal(false)
/** Why it does not. */
export const problem = signal<Error | null>(null)
/** The time "ago" counts from, a little behind. */
export const now = signal(Date.now())
export const blocked = computed(() => sessions(view.value).filter((s) => s.state === 'blocked').length)

export function paired(c: Credential) {
  localStorage.setItem(stored, JSON.stringify(c))
  batch(() => {
    notice.value = ''
    problem.value = null
    credential.value = c
  })
  connect()
}

// forget drops the credential, and with it all the page read with it.
export function forget(why = '') {
  localStorage.removeItem(stored)
  stop()
  cursor = null
  turns.clear()
  screens.clear()
  requests.clear()
  batch(() => {
    credential.value = null
    notice.value = why
    view.value = empty
    loaded.value = false
    answered.value = new Set()
  })
}

// authorized runs a request with the credential, and forgets a credential
// the computer no longer accepts.
async function authorized<T>(run: (token: string) => Promise<T>): Promise<T> {
  try {
    return await run(credential.value?.token ?? '')
  } catch (e) {
    if (e instanceof api.Failure && e.status === 401) {
      forget('The computer no longer accepts this device: its credential was revoked or expired. Pair it again.')
    }
    throw e
  }
}

// The watch: one stream while the page is paired, resumed from its cursor
// after it breaks, sooner the less it has failed. tmag pings every 15 s, so
// a stream quiet for 45 s is gone even if the network did not say so.
let cursor: string | null = null
let stream: AbortController | null = null
let retry: ReturnType<typeof setTimeout> | undefined
let failures = 0
let heard = 0

async function connect(): Promise<void> {
  clearTimeout(retry)
  if (stream || !credential.value) return
  const ctl = new AbortController()
  stream = ctl
  heard = Date.now()
  const quiet = setInterval(() => Date.now() - heard > 45_000 && ctl.abort(), 5_000)
  try {
    await authorized((token) =>
      api.watch(token, {
        since: cursor,
        signal: ctl.signal,
        onAlive() {
          heard = Date.now()
          failures = 0
          if (!live.value) {
            batch(() => {
              live.value = true
              problem.value = null
            })
          }
        },
        onDoc(doc, at) {
          if (at) cursor = at
          batch(() => {
            if (doc.type === 'snapshot') loaded.value = true
            view.value = apply(view.value, doc)
          })
        },
      }),
    )
  } catch (e) {
    problem.value = e as Error
  } finally {
    clearInterval(quiet)
    if (stream === ctl) stream = null
    live.value = false
  }
  if (!credential.value || stream) return
  if (ctl.signal.aborted) return connect() // fell quiet, or the page woke: at once
  failures++
  retry = setTimeout(connect, Math.min(15_000, 500 * 2 ** failures))
}

function stop() {
  clearTimeout(retry)
  stream?.abort()
  stream = null
  live.value = false
}

// wake resumes the watch at once when the page shows again: a phone may have
// suspended it in the background without ending it.
function wake() {
  if (document.hidden) return
  now.value = Date.now()
  if (stream && Date.now() - heard > 20_000) stream.abort()
  else void connect()
}

/** What a read gave, or why it failed; a failed read keeps what came before. */
export interface Read<T> {
  value?: T
  error?: Error
}

const turns = new Map<string, Signal<Read<Turn[]>>>()
const screens = new Map<string, Signal<Read<string>>>()
const requests = new Map<string, Signal<Read<RequestDoc>>>()
/** Requests answered from this page, hidden before the watch says so. */
export const answered = signal<ReadonlySet<string>>(new Set())

function slot<T>(m: Map<string, Signal<Read<T>>>, key: string): Signal<Read<T>> {
  const s = m.get(key) ?? signal<Read<T>>({})
  m.set(key, s)
  return s
}

export const turnsOf = (id: string) => slot(turns, id)
export const screenOf = (id: string) => slot(screens, id)
export const requestOf = (id: string) => slot(requests, id)

// read runs load now, or once more after the run in flight for the same
// slot, so that what it shows is never older than what asked for it.
const running = new Map<Signal<unknown>, { again: boolean }>()
function read<T>(into: Signal<Read<T>>, load: (token: string) => Promise<T>) {
  const run = running.get(into)
  if (run) {
    run.again = true
    return
  }
  const next = { again: false }
  running.set(into, next)
  void (async () => {
    do {
      next.again = false
      try {
        into.value = { value: await authorized(load) }
      } catch (e) {
        into.value = { ...into.value, error: e as Error }
      }
    } while (next.again)
    running.delete(into)
  })()
}

export function loadTurns(id: string) {
  read(turnsOf(id), async (t) => (await api.get<TurnsDoc>(t, 'read', { target: id, turns: 20 })).turns)
}

export function loadScreen(id: string) {
  read(screenOf(id), async (t) => (await api.get<ScreenDoc>(t, 'read', { target: id, lines: 120 })).text)
}

export function loadRequest(session: string, request: string) {
  const into = requestOf(request)
  if (!into.value.value) read(into, (t) => api.get<RequestDoc>(t, 'request', { target: session, request }))
}

export async function act(action: Action) {
  await authorized((t) => api.act(t, action))
  if (action.verb === 'answer') answered.value = new Set(answered.value).add(action.request)
}

// start follows the route, the watch and the clock while the page is open.
export function start() {
  addEventListener('hashchange', () => {
    route.value = parse(location.hash)
  })
  document.addEventListener('visibilitychange', wake)
  addEventListener('online', wake)
  setInterval(() => {
    if (!document.hidden) now.value = Date.now()
  }, 15_000)
  effect(() => {
    document.title = `${blocked.value ? `(${blocked.value}) ` : ''}tmag`
  })
  void connect()
}
