import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { Prompt, Session as S } from '../contract'
import { act, loaded, loadScreen, loadTurns, now, screenOf, turnsOf, view } from '../store'
import { ago, can, find, paneOf, place, status, stoppable } from '../view'
import { cls, explain, outcome } from './explain'
import { Markdown } from './Markdown'
import { Requests } from './Requests'

export type Say = (text: string, error?: boolean) => void

export function Session({ id }: { id: string }) {
  const v = view.value
  const s = find(v, id)
  const pane = s && paneOf(v, s)
  const [screen, setScreen] = useState(false)
  const showScreen = screen && !!pane
  const gone = loaded.value && !s
  const [toast, say] = useToast()

  // What the session shows is read again whenever the watch reports it: the
  // view makes a new object of each session an event or a snapshot reports.
  useEffect(() => {
    if (s) (showScreen ? loadScreen : loadTurns)(id)
  }, [id, s, showScreen])

  return (
    <div class="screen session">
      <header>
        <a class="back" href="#/" aria-label="Agents">
          ‹
        </a>
        <div class="what">
          <div class="name">{s ? place(s) : 'Session'}</div>
          <div class="meta">
            {s ? [s.agent, status(s), ago(s.since, now.value)].filter(Boolean).join(' · ') : gone ? 'not running' : ''}
          </div>
        </div>
        {pane && (
          <button class="mode" type="button" onClick={() => setScreen(!showScreen)}>
            {showScreen ? 'Turns' : 'Screen'}
          </button>
        )}
      </header>
      <Scroller key={showScreen ? 'screen' : 'turns'}>
        {gone ? (
          <p class="empty">This session is not running.</p>
        ) : showScreen ? (
          <Screen id={id} />
        ) : (
          <Turns id={id} s={s} />
        )}
      </Scroller>
      {s && <Requests s={s} say={say} />}
      <p class={cls('toast', toast.error && 'error')} role="status">
        {toast.text}
      </p>
      {!gone && <Composer id={id} s={s} say={say} />}
    </div>
  )
}

// Follow keeps a scroller at its end when what it shows changes, as long as
// the person has not scrolled away from it.
const Follow = createContext(() => {})

function Scroller({ children }: { children: ComponentChildren }) {
  const ref = useRef<HTMLElement>(null)
  const stick = useRef(true)
  const follow = useCallback(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [])
  useLayoutEffect(() => {
    // A keyboard that opens makes the scroller shorter.
    const el = ref.current
    if (!el) return
    const resized = new ResizeObserver(follow)
    resized.observe(el)
    return () => resized.disconnect()
  }, [follow])
  return (
    <main
      class="scroll"
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      }}
    >
      <Follow.Provider value={follow}>{children}</Follow.Provider>
    </main>
  )
}

function Turns({ id, s }: { id: string; s: S | undefined }) {
  const read = turnsOf(id).value
  const follow = useContext(Follow)
  // biome-ignore lint/correctness/useExhaustiveDependencies: what is read, or the state, changes what shows; a prompt the person unfolds does not move the scroller
  useLayoutEffect(follow, [follow, read, s?.state])
  const turns = read.value
  if (!turns) {
    return <p class={cls('empty', read.error && 'error')}>{read.error ? explain(read.error) : 'Reading its turns…'}</p>
  }
  // The turn that runs is the last one read, unless tmag names another,
  // which the transcript does not show yet.
  const working = s && s.state !== 'idle' ? s : undefined
  const last = turns[turns.length - 1]
  const runsLast = working && last && (!working.turn || working.turn === last.id)
  return (
    <div class="timeline">
      {turns.map((turn, i) => {
        const running = runsLast && turn === last
        return (
          <article class="turn" key={turn.id || i}>
            {turn.prompts.map((p, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a turn's prompts only grow at its end
              <PromptText key={j} p={p} />
            ))}
            {turn.reply ? <Markdown class="reply" src={turn.reply} /> : !running && <p class="muted">No reply</p>}
            {running && <Running s={working} />}
          </article>
        )
      })}
      {!turns.length && !working && <p class="empty">No turns yet.</p>}
      {working && !runsLast && <Running s={working} />}
      {read.error && <p class="muted error">{explain(read.error)}</p>}
    </div>
  )
}

const Running = ({ s }: { s: S }) => <p class={`running ${s.state}`}>{status(s)}…</p>

function PromptText({ p }: { p: Prompt }) {
  const [open, setOpen] = useState(false)
  const long = p.text.length > 600 || p.text.split('\n').length > 12
  const who = p.from === 'peer' ? 'from an agent' : p.from === 'task' ? 'background task' : p.from
  return (
    <div class={cls('prompt', p.from && 'from', long && !open && 'folded')}>
      {who && <span class="who">{who}</span>}
      {p.text || '(no text)'}
      {long && (
        <button class="more" type="button" onClick={() => setOpen(!open)}>
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  )
}

function Screen({ id }: { id: string }) {
  const read = screenOf(id).value
  const follow = useContext(Follow)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the screen read changes what shows
  useLayoutEffect(follow, [follow, read])
  const text = read.value ?? (read.error ? explain(read.error) : 'Reading its screen…')
  return <pre class="terminal">{text}</pre>
}

function Composer({ id, s, say }: { id: string; s: S | undefined; say: Say }) {
  const draft = `tmag.draft.${id}`
  const [text, setText] = useState(() => sessionStorage.getItem(draft) ?? '')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)

  // The box grows with what it holds, up to 40% of the window.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the text sets the box's scrollHeight
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, innerHeight * 0.4)}px`
  }, [text])

  const edit = (value: string) => {
    setText(value)
    if (value) sessionStorage.setItem(draft, value)
    else sessionStorage.removeItem(draft)
  }
  const prompts = !s || can(s, 'send')
  const sendable = !busy && !!s && prompts && !!text.trim()

  async function run(verb: 'send' | 'interrupt') {
    setBusy(true)
    try {
      if (verb === 'send') {
        await act({ verb, target: id, text })
        edit('')
        say('Sent')
      } else {
        await act({ verb, target: id })
        say('Stopped')
      }
    } catch (e) {
      say(outcome(e), true)
    }
    setBusy(false)
  }

  return (
    <form
      class="composer"
      onSubmit={(e) => {
        e.preventDefault()
        if (sendable) void run('send')
      }}
    >
      {s && stoppable(s) && (
        <button class="stop" type="button" disabled={busy} onClick={() => run('interrupt')}>
          Stop
        </button>
      )}
      {prompts ? (
        <>
          <textarea
            ref={box}
            rows={1}
            aria-label="Message"
            placeholder="Message"
            value={text}
            onInput={(e) => edit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && sendable) {
                e.preventDefault()
                void run('send')
              }
            }}
          />
          <button class="primary" type="submit" disabled={!sendable}>
            Send
          </button>
        </>
      ) : (
        <p class="muted">tmag has no way to prompt this session.</p>
      )}
    </form>
  )
}

// useToast holds a short message: a few seconds, longer for an error.
function useToast(): [{ text: string; error: boolean }, Say] {
  const [toast, setToast] = useState({ text: '', error: false })
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(hide.current), [])
  const say: Say = (text, error = false) => {
    clearTimeout(hide.current)
    setToast({ text, error })
    hide.current = setTimeout(() => setToast({ text: '', error: false }), error ? 12_000 : 3_000)
  }
  return [toast, say]
}
