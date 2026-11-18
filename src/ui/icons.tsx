// The page's icons: strokes in the colour of the text around them, drawn
// on a 24-unit grid, hidden from assistive technology, which reads the
// label of what holds them.

import type { ComponentChildren } from 'preact'

function Icon({ children, size = 20 }: { children: ComponentChildren; size?: number }) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const Back = () => (
  <Icon size={24}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)
export const Plus = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const Send = () => (
  <Icon>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)
export const Stop = () => (
  <Icon size={18}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </Icon>
)
export const Computers = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
)
export const Folder = () => (
  <Icon size={18}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
)
export const Branch = () => (
  <Icon size={14}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="8" r="2" />
    <path d="M6 8v8M18 10c0 4-6 3-11 6" />
  </Icon>
)
export const Next = () => (
  <Icon size={16}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)
export const Up = () => (
  <Icon size={18}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
)
export const Copy = () => (
  <Icon size={16}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
)
