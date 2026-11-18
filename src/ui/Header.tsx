import type { ComponentChildren } from 'preact'
import { back } from '../store'
import { Back } from './icons'

// Header is the bar a screen opens with: the way back, what the screen
// shows, and what the person may do there.
export function Header({
  title,
  meta,
  children,
  actions,
  up = true,
}: {
  title: ComponentChildren
  meta?: ComponentChildren
  children?: ComponentChildren
  actions?: ComponentChildren
  up?: boolean
}) {
  return (
    <header class="bar-top">
      {up && (
        <button class="icon-button back" type="button" aria-label="Back" onClick={back}>
          <Back />
        </button>
      )}
      <div class="what">
        <h1 class="name">{title}</h1>
        {meta && <div class="meta">{meta}</div>}
        {children}
      </div>
      {actions && <div class="actions-top">{actions}</div>}
    </header>
  )
}
