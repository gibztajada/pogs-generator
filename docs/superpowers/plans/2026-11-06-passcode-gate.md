# Passcode Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block every page and API route behind a shared 2-digit team passcode. The unlock page uses the magic-key animation from the approved mockup.

**Architecture:**
- **`lib/gate.ts`:** pure helpers for token derivation, constant-time compare, the `next` sanitiser and the proxy's allow/redirect/deny decision.
- **`proxy.ts`:** enforces the cookie on every request.
- **`app/api/unlock/route.ts`:** checks the code and sets the cookie.
- **`app/unlock/`:** a server page (config and already-unlocked checks) that renders a client component ported from the mockup.

**Tech Stack:** Next.js 16.4.1 (App Router + `proxy.ts`), React 19, Web Crypto, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-passcode-gate-design.md`. The mockup is `docs/superpowers/specs/assets/2026-11-06-passcode-gate-mockup.html`, and it is the source of truth for markup, CSS, keyframes and timings.

## Global Constraints

- Read `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `.../03-api-reference/03-file-conventions/proxy.md` before writing `proxy.ts`. Proxy runs on Node.js, and `runtime` config is forbidden in it.
- No new dependencies.
- Env var `APP_PASSCODE`. If it's missing, the gate fails closed: the page shows "Passcode not configured" and `/api/unlock` returns 503.
- Cookie `pogs_gate`:
  - value: `HMAC-SHA256(key=APP_PASSCODE, msg="pogs-gate-v1")`, base64url
  - flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=86400` (1 day), `Secure` only when `NODE_ENV==='production'`
- Wrong code: ~600 ms server delay, then `401 {ok:false}`. Right code: `200 {ok:true}` with no delay.
- Never log the passcode, cookie values or request bodies.
- Copy (exact strings):
  - "Enter the team passcode to reveal your key"
  - "Use the key to unlock"
  - "Incorrect passcode"
  - "Enter all 2 digits"
  - "ACCESS GRANTED"
  - "Opening POGS Generator…"
  - "Passcode not configured"
- The mockup's `Replay` button and its demo code check do **not** ship.

## Review Focus

1. **Open redirect through `next`:** `//evil.com`, `/\evil.com`, `https://evil.com` and `javascript:` must all fall back to `/` (unit test in Task 1).
2. **Public assets the PDF renderer or page needs:** `/fonts/*`, `/sheet-assets/*`, `/_next/*` and `favicon.ico` must not be redirected. Otherwise the PDF and the unlock page itself break (unit test in Task 1, plus the existing PDF api test in Task 2).
3. **Double submit:** auto-submit on the 2nd digit, followed by Enter, sends only one request (state guard; e2e in Task 3).
4. **Network or 5xx failure on `/api/unlock`:** show "Couldn't check the passcode. Try again." and stay usable (e2e with `page.route` in Task 3).
5. **Pasted or non-digit input** such as "1 5" or "a15": strip non-digits, cap at 2, and auto-submit "15" (e2e in Task 3).

---

### Task 1: Gate helpers

**Files:**
- Create: `lib/gate.ts`
- Test: `tests/unit/gate.test.ts`

**Interfaces (Produces):**
```ts
export const GATE_COOKIE = 'pogs_gate';
export const GATE_MAX_AGE = 86400;
export function gateToken(passcode: string): Promise<string>;          // HMAC-SHA256 via crypto.subtle, base64url, no padding
export function safeEqual(a: string, b: string): boolean;              // constant-time over max length; false if lengths differ
export function isValidGateCookie(value: string | undefined, passcode: string | undefined): Promise<boolean>; // false if either is empty
export function safeNext(next: string | null | undefined): string;     // relative path starting with exactly one '/', no '\\'; else '/'
export type GateDecision = 'allow' | 'redirect' | 'deny';
export function gateDecision(pathname: string, unlocked: boolean): GateDecision;
```
`gateDecision` returns:
- `'allow'` for public paths (`/unlock`, `/api/unlock`, `/_next/...`, `/favicon.ico`, `/fonts/...`, `/sheet-assets/...`, or any path whose last segment has a file extension), or when `unlocked`
- `'deny'` for locked `/api/...`
- `'redirect'` otherwise

- [ ] **Step 1: Write the failing tests** in `tests/unit/gate.test.ts`:
  - `gateToken('15')` resolves to the same value twice. It differs from `gateToken('16')` and matches `/^[A-Za-z0-9_-]+$/`.
  - `safeEqual('abc','abc')` is true; `safeEqual('abc','abd')` and `safeEqual('abc','ab')` are false.
  - `isValidGateCookie(await gateToken('15'),'15')` is true. `isValidGateCookie(undefined,'15')`, `isValidGateCookie('x','15')`, `isValidGateCookie(await gateToken('15'), undefined)` and `isValidGateCookie('', '')` are all false.
  - `safeNext`:
    - `'/'` maps to `'/'`; `'/dev/sheet/1?x=1'` is unchanged.
    - `'//evil.com'`, `'/\\evil.com'`, `'https://evil.com'`, `'javascript:alert(1)'`, `''`, `null` and `undefined` all map to `'/'`.
  - `gateDecision` cases:
    - `('/', false)` → `'redirect'`; `('/', true)` → `'allow'`; `('/dev/sheet/1', false)` → `'redirect'`
    - `('/api/pdf', false)` → `'deny'`; `('/api/unlock', false)` → `'allow'`; `('/unlock', false)` → `'allow'`
    - `('/_next/static/chunks/a.js', false)`, `('/fonts/arimo-400.woff2', false)`, `('/sheet-assets/x.png', false)` and `('/favicon.ico', false)` → `'allow'`
- [ ] **Step 2: Run** `npx vitest run tests/unit/gate.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/gate.ts`** as specified in Interfaces. Use `globalThis.crypto.subtle.importKey('raw', …, {name:'HMAC', hash:'SHA-256'})` and `sign`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/gate.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit:** `git add lib/gate.ts tests/unit/gate.test.ts && git commit -m "feat(gate): token, compare, next sanitiser, proxy decision"`

### Task 2: Unlock API, proxy, and test harness

The proxy breaks every existing Playwright suite until the harness unlocks, so the harness changes belong to this task.

**Files:**
- Create: `app/api/unlock/route.ts`, `proxy.ts`, `tests/global-setup.ts`, `tests/api/unlock.spec.ts`, `.env.example`
- Modify: `playwright.config.ts`, `.gitignore` (add `tests/.auth/`)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `POST /api/unlock` with body `{passcode: string}`, responding `200 {ok:true}`, `401 {ok:false}` (after ~600 ms), `400 {ok:false}` (bad body) or `503 {ok:false, error:'Passcode not configured'}`
  - Playwright `storageState` at `tests/.auth/state.json`

- [ ] **Step 1: Write the failing tests** `tests/api/unlock.spec.ts`. Each test uses a fresh `request` context with `storageState: { cookies: [], origins: [] }`:
  - `POST /api/pdf` with `sampleForm()` → 401.
  - `POST /api/unlock {passcode:'00'}` (or another code that isn't the test passcode) → 401, and no `set-cookie` header.
  - `POST /api/unlock {passcode: <test passcode>}` → 200, and `set-cookie` contains `pogs_gate=`, `HttpOnly`, `Max-Age=86400` and `SameSite=Lax`.
  - `GET /` without the cookie (with `maxRedirects: 0`) → 307 or 308 with `location` ending `/unlock?next=%2F`.
  - `GET /fonts/arimo-400.woff2` without the cookie → 200.
- [ ] **Step 2: Run** `npx playwright test --project=api tests/api/unlock.spec.ts`. Expected: FAIL (the PDF returns 200, `/api/unlock` is 404).
- [ ] **Step 3: Implement `app/api/unlock/route.ts`.** It's a `POST` handler that reads `process.env.APP_PASSCODE` and compares `safeEqual(body.passcode, APP_PASSCODE)`. On success it sets the cookie through `NextResponse.cookies.set(GATE_COOKIE, await gateToken(code), {...})` with the Global Constraints flags.
- [ ] **Step 4: Implement `proxy.ts`.**
  - Export `proxy(request: NextRequest)`. It computes `unlocked = await isValidGateCookie(request.cookies.get(GATE_COOKIE)?.value, process.env.APP_PASSCODE)` and switches on `gateDecision(request.nextUrl.pathname, unlocked)`:
    - `redirect` → `NextResponse.redirect(new URL('/unlock?next=' + encodeURIComponent(pathname + search), request.url))`
    - `deny` → `NextResponse.json({error:'Locked'}, {status:401})`
    - `allow` → `NextResponse.next()`
  - Add `config.matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']`.
- [ ] **Step 5: Implement the harness.**
  - `tests/global-setup.ts` resolves the passcode: `process.env.APP_PASSCODE`, else `process.loadEnvFile('.env.local')` if that file exists, else `'15'`. It sets `process.env.APP_PASSCODE`, POSTs to `${baseURL}/api/unlock`, throws `"Gate setup failed: running dev server uses a different APP_PASSCODE"` on a non-200 response, and saves `storageState` to `tests/.auth/state.json`.
  - In `playwright.config.ts`: add `globalSetup: './tests/global-setup.ts'` and `use.storageState: 'tests/.auth/state.json'`. Set `webServer.env: { APP_PASSCODE: process.env.APP_PASSCODE ?? '15' }`, resolving it the same way at the top of the config, so both agree.
  - `.env.example` contains `APP_PASSCODE=`.
- [ ] **Step 6: Run** `npx playwright test --project=api`. Expected: all PASS, including the existing `tests/api/pdf.spec.ts`.
- [ ] **Step 7: Run** `npx vitest run && npx playwright test --project=e2e --project=fidelity`. Expected: PASS. If fidelity has pre-existing failures, compare against `git stash` and report them rather than "fixing" them.
- [ ] **Step 8: Commit:** `git add app/api/unlock proxy.ts tests/global-setup.ts tests/api/unlock.spec.ts playwright.config.ts .gitignore .env.example && git commit -m "feat(gate): unlock API, proxy enforcement, test harness unlock"`

### Task 3: Unlock page

**Files:**
- Create: `app/unlock/page.tsx`, `app/unlock/UnlockGate.tsx`, `app/unlock/unlock.css`, `tests/e2e/gate.spec.ts`

**Interfaces:**
- Consumes:
  - `safeNext` and `isValidGateCookie` (Task 1)
  - `POST /api/unlock` (Task 2)
- Produces:
  - `export default async function UnlockPage({ searchParams }: PageProps<'/unlock'>)`
  - `export function UnlockGate({ next }: { next: string })` (a `'use client'` component)

`page.tsx` behaviour:
- If `APP_PASSCODE` is not set, render the card with the lock, the title and "Passcode not configured", without an input.
- Else, if the cookie (read with `cookies()` from `next/headers`) is valid, `redirect(safeNext(next))`.
- Else, render `<UnlockGate next={safeNext(next)} />`.

`UnlockGate` port of the mockup:
- **Keep from the mockup:** markup, CSS and timings. Prefix every class with `ug-` in `unlock.css` and import it from the component.
- **Drop:** the mockup's subtitle, its `Replay` button and the hard-coded demo code check.
- **Phases:** `phase: 'typing' | 'checking' | 'ready' | 'flying' | 'done'`, with `useRef` for DOM nodes.
- **Checking:**
  - When the 2nd digit arrives, or Enter is pressed with 2 digits while `phase==='typing'`, set `phase='checking'` and POST.
  - 401 → shake, show "Incorrect passcode", select the input, back to `typing`.
  - Network error or other non-200 → show "Couldn't check the passcode. Try again." and go back to `typing`.
  - 200 → the `ready` sequence: dialog 1 floats away, motes gather, the key materialises, dialog 2 types "Use the key to unlock", and the hand appears.
- **Catching the key:** `flying` runs the key-insertion WAAPI chain from the mockup's `fly()`. At `done`, after about 3.5 s total, call `router.replace(next)`.
- **Reduced motion and touch:**
  - With `matchMedia('(prefers-reduced-motion: reduce)')`: no motes, flight, burst or hand. The key fades in, and catching it shows ACCESS GRANTED, then `router.replace(next)` after 1000 ms.
  - With `(hover: none)`: no hand.
- **Clean-up:** clear all timers and intervals on unmount.

- [ ] **Step 1: Write the failing tests** in `tests/e2e/gate.spec.ts`. Use `test.use({ storageState: { cookies: [], origins: [] } })`; the code comes from `process.env.APP_PASSCODE`.
  - `locked root redirects to unlock`: `goto('/')` ends at `/unlock`. The text "Enter the team passcode to reveal your key" is visible, and `getByRole('button', {name:'Unlock'})` is hidden.
  - `wrong code shows error and no key`: type a code that isn't the passcode. "Incorrect passcode" is visible and the Unlock key stays hidden.
  - `right code reveals key; catching it opens the app`: type the code. "Use the key to unlock" is visible, the Unlock key is visible and focused. Click it, then `expect(page).toHaveURL('/', {timeout: 8000})`.
  - `next is honoured`: `goto('/unlock?next=%2Fdev%2Fsheet%2F1')`, unlock, and the page ends at `/dev/sheet/1`.
  - `pasted digits are cleaned`: fill the input with `'a1 5'`. The input value becomes `'15'` and the key appears.
  - `one request per attempt`: count `/api/unlock` requests through `page.on('request')`. Type the 2 digits, then press Enter; the count is 1.
  - `network failure is recoverable`: use `page.route('**/api/unlock', r => r.abort())` and type the code. "Couldn't check the passcode. Try again." is visible. Unroute, retype, and the key appears.
  - `keyboard catch`: after the key appears, `keyboard.press('Enter')` reaches `/`.
- [ ] **Step 2: Run** `npx playwright test --project=e2e tests/e2e/gate.spec.ts`. Expected: FAIL (`/unlock` is 404).
- [ ] **Step 3: Implement `app/unlock/page.tsx`, `UnlockGate.tsx` and `unlock.css`** as described above.
- [ ] **Step 4: Run** `npx playwright test --project=e2e`. Expected: PASS, including the existing `app.spec.ts`.
- [ ] **Step 5: Run** `npm run lint && npx tsc --noEmit && npm run build`. Expected: no errors, and the build output lists `ƒ Proxy`.
- [ ] **Step 6: Manual check:** start `npm run dev`, open `/`, and walk through the wrong code, the right code, catching the key, and reduced motion (DevTools rendering emulation). Compare against the mockup side by side.
- [ ] **Step 7: Commit:** `git add app/unlock tests/e2e/gate.spec.ts && git commit -m "feat(gate): magic-key unlock page"`

### Task 4: Deployment note

- [ ] **Step 1:** Remind the user to add `APP_PASSCODE=15` to the Vercel project's environment variables (Production and Preview) before deploying. Without it the deployed app is locked for everyone, by design. Do not run `vercel` commands yourself.
