import { describe, expect, it } from 'vitest'
import { expand, inside, snippet, tilde, where } from './places'

describe('where', () => {
  // A directory tmag names no repository for is a project of its own.
  it('names a directory by itself without a repository', () => {
    expect(where('/home/me/notes')).toEqual({ root: '/home/me/notes', name: 'notes', worktree: false, sub: '' })
  })

  // Every worktree of a repository, and every directory in one, is the
  // project of its main worktree.
  it('names a directory in a repository by its main worktree', () => {
    const repo = { top: '/src/api', main: '/src/api', branch: 'main' }
    expect(where('/src/api', repo)).toEqual({ root: '/src/api', name: 'api', branch: 'main', worktree: false, sub: '' })
    expect(where('/src/api/pkg/db', repo)).toMatchObject({ name: 'api', sub: 'pkg/db', worktree: false })
    const tree = { top: '/src/api/.worktrees/fix', main: '/src/api', branch: 'fix/login' }
    expect(where('/src/api/.worktrees/fix/web', tree)).toEqual({
      root: '/src/api',
      name: 'api',
      branch: 'fix/login',
      worktree: true,
      sub: 'web',
    })
    expect(where('/w/bare/x', { top: '/w/bare/x' })).toMatchObject({ root: '/w/bare/x', name: 'x', worktree: false })
  })
})

describe('paths', () => {
  it('writes and reads a path under the home directory from ~', () => {
    expect(tilde('/home/me/src', '/home/me')).toBe('~/src')
    expect(tilde('/home/me', '/home/me')).toBe('~')
    expect(tilde('/home/mel/src', '/home/me')).toBe('/home/mel/src')
    expect(tilde('/src', undefined)).toBe('/src')
    expect(expand('~/src', '/home/me')).toBe('/home/me/src')
    expect(expand('~', '/home/me/')).toBe('/home/me')
    expect(expand('~me/x', '/home/me')).toBe('~me/x')
    expect(inside('/a/b', '/a')).toBe('b')
    expect(inside('/ab', '/a')).toBeUndefined()
    expect(inside('/a', '/')).toBe('a')
  })
})

describe('snippet', () => {
  it('reads Markdown as plain words on one line', () => {
    expect(snippet('## Summary\n\n- **Fixed** the `login` [redirect](https://x.y)\n- 2. done')).toBe(
      'Summary Fixed the login redirect 2. done',
    )
    expect(snippet('Run:\n```sh\nrm -rf /\n```\nthen > quote')).toBe('Run: rm -rf / then > quote')
    expect(snippet('a'.repeat(300), 10)).toBe(`${'a'.repeat(9)}…`)
  })
})
