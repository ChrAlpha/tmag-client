// Where sessions run, as the page shows and groups them: each session's
// project, the repository's main worktree where tmag says which repository
// its directory is in, or else the directory itself, and where in the
// project it runs; and a line or two of what an agent wrote, as plain text.

import type { Repo } from './contract'

/** Where a directory is, as the page names it. */
export interface Where {
  /** The project: the repository's main worktree, or the directory itself. */
  root: string
  /** The project's name: its root's last element. */
  name: string
  /** The branch its work tree has checked out, when tmag says so. */
  branch?: string
  /** Whether it is in a worktree other than the main one. */
  worktree: boolean
  /** Where in its work tree, or in its project, it is: '' at the top. */
  sub: string
}

const base = (path: string) => path.split('/').filter(Boolean).pop() ?? path

// inside is the path of dir under root, '' for root itself, or undefined
// when dir is not under root.
export function inside(dir: string, root: string): string | undefined {
  if (dir === root) return ''
  const prefix = root.endsWith('/') ? root : `${root}/`
  return dir.startsWith(prefix) ? dir.slice(prefix.length) : undefined
}

// where says where a directory is: in the repository tmag says it is in, or
// else a project of its own.
export function where(dir: string, repo?: Repo): Where {
  if (!repo) return { root: dir, name: base(dir), worktree: false, sub: '' }
  const root = repo.main ?? repo.top
  return {
    root,
    name: base(root),
    ...(repo.branch ? { branch: repo.branch } : {}),
    worktree: repo.top !== root,
    sub: inside(dir, repo.top) ?? '',
  }
}

// tilde writes a path under the home directory from ~.
export function tilde(path: string, home?: string): string {
  if (!home || home === '/') return path
  const under = inside(path, home)
  return under === undefined ? path : under ? `~/${under}` : '~'
}

// expand reads a path typed from ~ as one from the home directory.
export function expand(path: string, home?: string): string {
  if (!home || !(path === '~' || path.startsWith('~/'))) return path
  return `${home.replace(/\/$/, '')}${path.slice(1)}`
}

// snippet is the first words of what an agent wrote in Markdown, as plain
// text on one line, at most max characters.
export function snippet(text: string, max = 280): string {
  const words = text
    .split('\n')
    .filter((line) => !/^\s*(```|~~~)/.test(line))
    .map((line) =>
      line
        .replace(/^\s*(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|`)/g, ''),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return words.length > max ? `${words.slice(0, max - 1).trimEnd()}…` : words
}
