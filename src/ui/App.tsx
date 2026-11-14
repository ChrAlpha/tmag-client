import { credential, live, problem, route } from '../store'
import { Agents } from './Agents'
import { explain } from './explain'
import { Pair } from './Pair'
import { Session } from './Session'

export function App() {
  const r = route.value
  return (
    <div class="app">
      <Bar />
      {!credential.value ? <Pair /> : r.name === 'session' ? <Session key={r.id} id={r.id} /> : <Agents />}
    </div>
  )
}

// Bar says, while the page is paired, that the watch does not deliver, and why.
function Bar() {
  if (!credential.value || live.value) return null
  const p = problem.value
  return (
    <div class={p ? 'bar error' : 'bar'} role="status">
      {p ? `${explain(p)} Trying again…` : 'Connecting…'}
    </div>
  )
}
