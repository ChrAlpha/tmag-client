import { Failure } from '../api'

// explain says what went wrong, and for a refused address how to allow it.
export function explain(e: unknown): string {
  if (e instanceof Failure && e.status === 403 && e.code === 'forbidden') {
    return `tmag serve does not accept this page's address. On the computer, set -g @tmag-serve '--host ${location.host} --origin ${location.origin}' and restart serve.`
  }
  return e instanceof Error ? e.message : String(e)
}

// outcome tells what became of an action that failed: one whose answer was
// lost may or may not have happened.
export function outcome(e: unknown): string {
  if (e instanceof Failure && e.code === 'network') {
    return 'The computer did not answer, so it may or may not have done it: check before trying again.'
  }
  return explain(e)
}

/** cls joins the class names that apply. */
export const cls = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')
