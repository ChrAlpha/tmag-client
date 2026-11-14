import { expect, type Page, test } from '@playwright/test'
import type { Credential } from '../src/contract'
import {
  type Agent,
  addTurn,
  agents,
  credential,
  pairingCode,
  person,
  said,
  session,
  startServe,
  stopServe,
} from './world'

const { api, web } = agents

// Each test pairs anew, so tests run alone, and one after another: they
// share the agents.
test.describe.configure({ mode: 'serial' })

async function paired(page: Page): Promise<Credential> {
  const c = await credential()
  await page.addInitScript((c) => localStorage.setItem('tmag.credential', JSON.stringify(c)), c)
  return c
}

const open = (page: Page, a: Agent) => page.goto(`/#/s/${a.session}`)

async function idle(a: Agent) {
  await expect.poll(() => session(a)?.state, { timeout: 15_000 }).toBe('idle')
}

async function prompt(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message' }).fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test.afterEach(async () => {
  for (const a of Object.values(agents)) await idle(a)
})

test('pairs with a code and opens the session it was sent to', async ({ page }) => {
  await open(page, api)
  await expect(page.getByRole('heading', { name: 'Pair this device' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Code' }).fill('WRONGCODE')
  await page.getByRole('button', { name: 'Pair' }).click()
  await expect(page.getByRole('alert')).toHaveText('That code is wrong, used or expired: run tmag auth pair again.')

  await page.getByRole('textbox', { name: 'Code' }).fill(pairingCode().toLowerCase())
  await page.getByRole('button', { name: 'Pair' }).click()
  await expect(page.locator('header .name')).toHaveText('api')
  await page.getByRole('link', { name: 'Agents' }).click()
  for (const name of ['api', 'web', 'docs']) await expect(page.locator('.row .name', { hasText: name })).toBeVisible()
  await expect(page.locator('footer')).toContainText('This device: e2e')
})

test("shows a session's turns, and what agents write as Markdown that stays text", async ({ page }) => {
  await paired(page)
  addTurn(api, {
    id: 'p-md',
    peer: `[tmag] From codex 0b000000, another agent.\n${Array.from({ length: 20 }, (_, i) => `step ${i}`).join('\n')}`,
    reply: [
      '## Build',
      '',
      '1. Build it:',
      '   ```sh',
      '   go build ./...',
      '   ```',
      '2. Check https://example.com/docs?a=1&b=2.',
      '',
      '| Package | Result |',
      '| --- | --- |',
      '| `internal/serve` | ok |',
      '',
      'Tom &amp; Jerry <img src=x onerror=alert(1)> <script>alert(2)</script> [x](javascript:alert(3))',
    ].join('\n'),
  })
  let dialogs = 0
  page.on('dialog', (d) => {
    dialogs++
    void d.dismiss()
  })
  await open(page, api)
  const reply = page.locator('.reply').last()
  await expect(reply.locator('ol > li > pre')).toHaveText('go build ./...\n')
  await expect(reply.locator('ol > li')).toHaveCount(2)
  await expect(reply.locator('table td code')).toHaveText('internal/serve')
  await expect(reply.locator('a')).toHaveAttribute('href', 'https://example.com/docs?a=1&b=2')
  await expect(reply).toContainText(
    'Tom & Jerry <img src=x onerror=alert(1)> <script>alert(2)</script> [x](javascript:alert(3))',
  )
  await expect(reply.locator('img, script, a[href^="javascript"]')).toHaveCount(0)
  expect(dialogs).toBe(0)

  const peer = page.locator('.prompt.from').last()
  await expect(peer.locator('.who')).toHaveText('from an agent')
  await expect(peer).toHaveClass(/folded/)
  await peer.getByRole('button', { name: 'Show all' }).click()
  await expect(peer).not.toHaveClass(/folded/)
})

test('allows a permission, and the title counts what waits', async ({ page }) => {
  await paired(page)
  await open(page, api)
  await prompt(page, 'block')
  const card = page.locator('.card')
  await expect(card.getByRole('heading')).toHaveText('Allow Bash?')
  await expect(card.locator('.asks pre').first()).toHaveText('date')
  await expect(page).toHaveTitle('(1) tmag')
  await card.getByRole('button', { name: 'Allow' }).click()
  await expect(card).toHaveCount(0)
  await expect.poll(() => said(api).at(-1)).toBe('hook:allow')
  await expect(page).toHaveTitle('tmag')
})

test('keeps what is typed in a card while the watch reports other sessions, and denies with it', async ({ page }) => {
  const c = await paired(page)
  await open(page, api)
  await prompt(page, 'block')
  const reason = page.getByRole('textbox', { name: 'Reason' })
  await reason.click()
  await page.keyboard.type('half a rea')
  // Another session starts and ends a turn while the person types.
  await page.evaluate(
    async ({ token, target }) => {
      await fetch('/v2/act', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ verb: 'send', target, text: 'meanwhile' }),
      })
    },
    { token: c.token, target: web.session },
  )
  await expect.poll(() => said(web).includes('meanwhile')).toBe(true)
  await idle(web)
  await page.keyboard.type('son')
  await expect(reason).toBeFocused()
  await expect(reason).toHaveValue('half a reason')
  await page.getByRole('button', { name: 'Deny' }).click()
  await expect(page.locator('.card')).toHaveCount(0)
  await expect.poll(() => said(api).at(-1)).toBe('hook:deny:half a reason')
})

test('answers a question', async ({ page }) => {
  await paired(page)
  await open(page, api)
  await prompt(page, 'ask')
  const card = page.locator('.card')
  await expect(card.locator('legend')).toHaveText('Pick a color')
  await card.getByRole('button', { name: 'Answer' }).click()
  await expect(card.getByRole('alert')).toHaveText('Answer each question.')
  await card.getByRole('button', { name: 'blue' }).click()
  await expect(card.getByRole('button', { name: 'blue' })).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: 'Answer' }).click()
  await expect(card).toHaveCount(0)
  await expect.poll(() => said(api).at(-1)).toBe('hook:allow Pick a color=blue')
})

test('stops a turn, and shows the screen of its pane', async ({ page }) => {
  await paired(page)
  await open(page, api)
  await prompt(page, 'a long task')
  await expect(page.locator('.running')).toHaveText('working…')
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect.poll(() => said(api).at(-1)).toBe('interrupted')

  await page.getByRole('button', { name: 'Screen' }).click()
  await expect(page.locator('pre.terminal')).toContainText('ready')
  await page.getByRole('button', { name: 'Turns' }).click()
  await expect(page.locator('.timeline')).toBeVisible()
})

test('says when tmag serve is gone, and picks up where it was when it is back', async ({ page }) => {
  await paired(page)
  await open(page, api)
  await expect(page.locator('.turn').first()).toBeVisible()
  stopServe()
  await expect(page.getByRole('status').first()).toContainText('Trying again…')
  startServe()
  await expect(page.locator('.bar')).toHaveCount(0, { timeout: 20_000 })
  await prompt(page, 'after the restart')
  await expect(page.locator('.reply').last()).toHaveText('answered: after the restart', { timeout: 15_000 })
})

test('asks to pair again once the credential is revoked', async ({ page }) => {
  const c = await paired(page)
  await page.goto('/')
  await expect(page.locator('.row').first()).toBeVisible()
  person(`tmag auth revoke ${c.id}`)
  await expect(page.locator('.notice')).toHaveText(
    'The computer no longer accepts this device: its credential was revoked or expired. Pair it again.',
  )
})

test('tells how to let tmag serve accept an address it refuses', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')
  await page.getByRole('textbox', { name: 'Code' }).fill(pairingCode())
  await page.getByRole('button', { name: 'Pair' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    "tmag serve does not accept this page's address. On the computer, set -g @tmag-serve '--host 127.0.0.1:4173 --origin http://127.0.0.1:4173' and restart serve.",
  )
})
