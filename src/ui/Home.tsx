import type { ComponentChildren } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'
import type { Computer } from '../computer'
import type { Place } from '../contract'
import { tilde, where } from '../places'
import { hash, type Route } from '../route'
import { computers, type Entry, go, home, needs, projects, sections, title, waiting } from '../store'
import { cls } from './explain'
import { Branch, Computers, Folder, Plus } from './icons'
import { Row } from './Row'

// Home is every computer's sessions, as an inbox of what waits on the
// person, works and rests, or by the projects they run in; with the way to
// start another agent and to the computers this device works with.
// Where the person scrolled each view to, for as long as the page is open.
const scrolled: Record<string, number> = {}

export function Home() {
  const view = home.value
  // Coming back to a view, the person finds it where they left it.
  const main = useRef<HTMLElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a view the person switches to is scrolled where they left it
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = scrolled[view] ?? 0
  }, [view])
  const all = computers.value
  const loaded = all.every((c) => c.loaded.value)
  // Until each computer answers or says why not, the sessions are still to come.
  const coming = all.some((c) => !c.loaded.value && !c.problem.value)
  const known = all.some((c) => c.view.value.sessions.size)
  const starts = all.some((c) => c.can('start'))
  const health = all.some((c) => c.problem.value || c.outdated.value) ? 'bad' : loaded ? '' : 'wait'
  return (
    <div class="screen home">
      <header class="bar-top">
        <h1 class="hidden">{view === 'inbox' ? 'Inbox' : 'Projects'}</h1>
        <nav class="views" aria-label="Sessions">
          <Tab to="inbox" current={view}>
            Inbox{waiting.value > 0 && <span class="badge">{waiting.value}</span>}
          </Tab>
          <Tab to="projects" current={view}>
            Projects
          </Tab>
        </nav>
        <div class="actions-top">
          {starts && (
            <a class="icon-button" href={hash({ name: 'start', at: '' })} aria-label="New agent">
              <Plus />
            </a>
          )}
          <a class={cls('icon-button', 'health', health)} href={hash({ name: 'settings' })} aria-label="Computers">
            <Computers />
          </a>
        </div>
      </header>
      <main
        class="scroll"
        ref={main}
        onScroll={(e) => {
          scrolled[view] = e.currentTarget.scrollTop
        }}
      >
        {!known && coming ? (
          <Skeleton />
        ) : !known && !loaded ? (
          <div class="empty">
            <p>No computer answers.</p>
            <p class="muted">The bar above says why. The page keeps trying.</p>
          </div>
        ) : view === 'inbox' ? (
          <Inbox starts={starts} />
        ) : (
          <Projects starts={starts} />
        )}
      </main>
    </div>
  )
}

function Tab({ to, current, children }: { to: 'inbox' | 'projects'; current: string; children: ComponentChildren }) {
  return (
    <a
      class="view"
      href={hash({ name: to })}
      aria-current={to === current ? 'page' : undefined}
      onClick={(e) => {
        // Switching views takes no entry of its own: back leaves the sessions.
        e.preventDefault()
        go({ name: to }, { replace: true })
      }}
    >
      {children}
    </a>
  )
}

function Skeleton() {
  return (
    <ul class="rows" aria-busy="true" aria-label="Reading sessions">
      {[0, 1, 2].map((i) => (
        <li key={i} class="row skeleton">
          <span class="dot" />
          <span class="body">
            <span class="bone" />
            <span class="bone short" />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Section({ label, entries }: { label: string; entries: Entry[] }) {
  if (!entries.length) return null
  return (
    <section class="section" aria-label={label}>
      <h2 class="label">
        {label} <span class="n">{entries.length}</span>
      </h2>
      <ul class="rows">
        {entries.map((e) => (
          <Row key={`${e.c.name}/${e.s.agent}/${e.s.id}`} e={e} />
        ))}
      </ul>
    </section>
  )
}

function Empty({ starts }: { starts: boolean }) {
  return (
    <div class="empty">
      <p>No agent is running.</p>
      <p class="muted">Start one here or in tmux, and it shows up as soon as tmag sees it.</p>
      {starts && (
        <a class="button primary" href={hash({ name: 'start', at: '' })}>
          New agent
        </a>
      )}
    </div>
  )
}

function Inbox({ starts }: { starts: boolean }) {
  const { waits, works, rest } = sections.value
  if (!waits.length && !works.length && !rest.length) return <Empty starts={starts} />
  return (
    <>
      {!waits.length && <p class="clear">Nothing waits on you.</p>}
      <Section label="Needs you" entries={waits} />
      <Section label="Working" entries={works} />
      <Section label="Idle" entries={rest} />
    </>
  )
}

// Projects are the sessions by the project they run in, each with the way
// to start another agent there; then the places sessions ran in lately that
// none runs in now.
function Projects({ starts }: { starts: boolean }) {
  const all = projects.value
  const several = computers.value.length > 1
  const busy = new Set(all.map((p) => `${p.c.name}\u0000${p.where.root}`))
  const recent = computers.value.flatMap((c) => idle(c, busy))
  if (!all.length && !recent.length) return <Empty starts={starts} />
  return (
    <>
      {all.map((p) => {
        const waits = p.entries.filter(needs).length
        return (
          <section key={p.key} class="project" aria-label={p.where.name}>
            <div class="project-head">
              <Folder />
              <div class="what">
                <h2 class="name">
                  {p.where.name}
                  {waits > 0 && <span class="badge">{waits}</span>}
                </h2>
                <div class="meta">
                  {[tilde(p.where.root, p.c.places.value.value?.home), several && title(p.c)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {starts && p.c.can('start') && p.where.root.startsWith('/') && (
                <StartHere to={{ name: 'start', at: p.c.name, dir: p.where.root }} name={p.where.name} />
              )}
            </div>
            <ul class="rows">
              {p.entries.map((e) => (
                <Row key={`${e.c.name}/${e.s.agent}/${e.s.id}`} e={e} in />
              ))}
            </ul>
          </section>
        )
      })}
      {recent.length > 0 && (
        <section class="section" aria-label="Recent">
          <h2 class="label">Recent</h2>
          <ul class="rows places">
            {recent.map(({ c, place, w }) => (
              <li key={`${c.name}/${place.dir}`} class="row place">
                <a class="row-link" href={hash({ name: 'start', at: c.name, dir: place.dir })}>
                  <Folder />
                  <span class="body">
                    <span class="line1">
                      <span class="name">{w.name}</span>
                      {w.branch && (
                        <span class={cls('chip', w.worktree && 'tree')}>
                          <Branch />
                          {w.branch}
                        </span>
                      )}
                    </span>
                    <span class="meta">
                      {[tilde(place.dir, c.places.value.value?.home), several && title(c)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span class="go">Start</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// idle is the places a computer's sessions ran in lately that no project
// with sessions holds now, the latest of each of a project's worktrees.
function idle(c: Computer, busy: Set<string>): { c: Computer; place: Place; w: ReturnType<typeof where> }[] {
  if (!c.can('start')) return []
  const seen = new Set<string>()
  return (c.places.value.value?.recent ?? []).flatMap((place) => {
    const w = where(place.dir, place.repo)
    const key = place.repo?.top ?? place.dir
    if (busy.has(`${c.name}\u0000${w.root}`) || seen.has(key)) return []
    seen.add(key)
    return [{ c, place, w }]
  })
}

function StartHere({ to, name }: { to: Route; name: string }) {
  return (
    <a class="icon-button" href={hash(to)} aria-label={`New agent in ${name}`}>
      <Plus />
    </a>
  )
}
