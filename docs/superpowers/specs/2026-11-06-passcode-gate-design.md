# Passcode Gate: Design

Date: 2026-11-06
Status: approved look; awaiting doc approval
Mockup: [assets/2026-11-06-passcode-gate-mockup.html](assets/2026-11-06-passcode-gate-mockup.html) (open in a browser; demo code `15`. It is the source of truth for look and motion.)

## Intent

The POGS Generator is used by a few trusted colleagues. Before anyone can use the app, they must enter a shared team passcode on a dedicated page. The goal is to **keep casual visitors out**, not to provide per-user accounts. The page should be playful and memorable: a magic key appears for the right code, and you "catch" it to unlock.

## Goals

- Every app page and API route is unreachable until the browser has been unlocked with the team passcode.
- The check happens on the server. Tampering with the page in the browser can't get around it.
- A delightful unlock page that matches the mockup: the dark "Midnight aurora" theme, fancy dialogs, a key that appears by magic, the hand cursor, and the key-into-lock animation.

## Non-goals

- User accounts, per-person codes, audit logs, or "who unlocked" tracking.
- A logout button or admin UI for changing the code. The code changes by updating an environment variable.
- Strong protection against a determined attacker (see Accepted risk).

## Anti-goals (failure even if it "works")

- The passcode or anything derived from it appears in client JS, the HTML or git.
- Any route, especially `POST /api/pdf`, is reachable without the unlock cookie.
- The animation makes unlocking slow or confusing for repeat users, or traps keyboard or touch users.
- Existing tests (unit, api, e2e, fidelity) break without a deliberate way to pass the gate.

## Constraints

- Next.js **16.4.1**. Middleware is now **`proxy.ts`** at the project root (see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). Read the bundled docs before writing code (AGENTS.md).
- Deployed on Vercel. The PDF route is `pages/api/pdf.ts` (Pages Router). The app is App Router (`app/`).
- No new dependencies. React 19, Tailwind v4 are present. Use Web Crypto (`crypto.subtle`), which is available in the proxy runtime.
- The app handles patient data. Never log request bodies, the passcode, or cookie values.

## Decided by the user

**Passcode:** two digits, `15`. It is stored as an environment variable, never in code.

**Visual style: Midnight aurora.** A dark navy background (`#070b18`) with a slowly rotating blurred aurora (green `#00ffa3` / blue `#3a7bff` / purple `#b44bff`) and twinkling stars. The centered card is glass-dark with a soft blue glow.

**Card contents:** a glowing gradient lock icon (SVG with separate loop, body and keyhole parts), the title "POGS Generator", and a 2-digit masked numeric input. There is no submit button.

**Caption as a fancy dialog:** on load, a dialog drops in above the card with an arrow pointing down at the lock. Its border rotates through the aurora colours, a gleam of light sweeps around it periodically, and the text **"Enter the team passcode to reveal your key"** types itself out with a blinking caret.

**Checking:** the code is submitted automatically when the 2nd digit is typed. Enter also submits, and shows "Enter all 2 digits" if the code is incomplete. Non-digits are stripped.

**Wrong code:** the card shakes, the lock wobbles, the dialog wobbles, "Incorrect passcode" appears under the input, and the digits are selected so they can be retyped.

**Right code:**
1. The input glows green.
2. The top dialog floats up and dissolves.
3. Sparks gather at the card's bottom edge, and the **key appears magically** (spins and scales in with a flash). The key is a gradient SVG with "UNLOCK" written on the blade. It then floats, a shine sweeps across it, and ✦ twinkles appear around it.
4. A second fancy dialog, **"Use the key to unlock"**, appears below the key with an arrow pointing up at it, typed out the same way.
5. The **hand cursor appears only now**: a yellow emoji hand that follows the pointer (open 🖐️, then a pinch 🤏 when near the key's ring). There is no hand and no key before the code is accepted.

**Catching the key:** clicking or pinching the key gives a squeeze. The hand and dialog fade. The key flies in an arc to the lock, slides into the keyhole (shrinking as it goes in), and turns 90° together with the keyhole. The lock's loop pops open, a double ring and sparks burst out, the card dissolves, and the lock rises. **"ACCESS GRANTED"**, "Opening POGS Generator…" and a progress bar appear, then the app loads.

## Builder's calls (made during brainstorming; change if needed)

### Server

- **Env vars:** `APP_PASSCODE` (required). If it is missing, the gate **fails closed**: the unlock page shows "Passcode not configured" and nothing unlocks. Add it to `.env.example` (create one if absent) and the Vercel project.
- **`POST /api/unlock`** (App Router route handler, `app/api/unlock/route.ts`): body `{ passcode: string }`.
  - Wrong code: wait about 600 ms, then respond `401 { ok: false }`. The delay slows guessing.
  - Right code (constant-time comparison): set the cookie and respond `200 { ok: true }`.
- **Cookie `pogs_gate`:** the value is `HMAC-SHA256(key = APP_PASSCODE, message = "pogs-gate-v1")` encoded as base64url. Changing the passcode therefore invalidates all existing cookies. The cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, and **lasts 30 days**. (The user wasn't asked about the 30 days, so it's flagged here for review.)
- **`proxy.ts`:** checks the cookie on every request except `/unlock`, `/api/unlock`, `_next/static`, `_next/image`, `favicon.ico`, `fonts/*` and other `public/` static files.
  - A missing or invalid cookie on a page request redirects to `/unlock?next=<path>`.
  - A missing or invalid cookie on an `/api/*` request returns `401 JSON`. This includes `POST /api/pdf`.
- **`/unlock` with a valid cookie** redirects to `next` or `/`. `next` must be a same-origin relative path starting with a single `/`; anything else falls back to `/`.
- Shared helpers go in `lib/gate.ts` (token derivation and a constant-time compare) so they can be unit tested.

### Client

- The unlock page is `app/unlock/page.tsx` plus a client component (for example `app/unlock/UnlockGate.tsx`) and its CSS, ported from the mockup into idiomatic React. Use component state instead of the mockup's DOM class toggling where that's natural. The CSS can be a co-located CSS module or a global stylesheet scoped to the page. Keyframes and timings come from the mockup.
- The key appears **only after the server returns 200**. The client never knows the code.
- After the unlock animation finishes (about 3.5 s), navigate with `router.replace(next)`.
- **Accessibility:**
  - The input is labelled.
  - The dialogs are live regions.
  - The key is a focusable `<button aria-label="Unlock">` that receives focus when it appears, and Enter or Space catches it.
  - With `prefers-reduced-motion: reduce`, skip the spark gathering, flight and burst. The key fades in, the hand cursor is not used, catching the key fades straight to "ACCESS GRANTED", and the app opens after about 1 s.
- **Touch devices** (`(hover: none)`): there is no hand cursor, and tapping the key catches it.
- The mockup shows emoji hands. These render with the system emoji font, which is acceptable.

### Tests

- **Vitest:** `lib/gate.ts` (the token is stable for a given code, differs between codes, and the compare rejects wrong or empty values), plus the proxy's decision logic (factor it into a pure function: allow, redirect or 401).
- **Playwright (new `tests/e2e/gate.spec.ts`):**
  - Locked `/` redirects to `/unlock`.
  - A wrong code shows "Incorrect passcode".
  - The right code reveals the key, and clicking it lands on `/`.
  - `POST /api/pdf` without the cookie returns 401.
- **Existing suites:** the Playwright `webServer` runs with a test `APP_PASSCODE`. The `api`, `e2e` and `fidelity` projects get the cookie through a shared global setup that calls `/api/unlock` and saves `storageState`. API tests that use `request` must send the cookie too.

### Settled after builder review (builder's calls)

- **Which code the tests use:** the Playwright global setup reads `APP_PASSCODE` from `process.env`. If it isn't set, it loads `.env.local` with Node 22's `process.loadEnvFile`, then falls back to `15`. `webServer.env` passes the same value. Because `reuseExistingServer: true` stays, a dev server that is already running must use the same code; the setup fails with a clear message if `/api/unlock` returns 401.
- **`/dev/sheet/*` is gated like everything else.** It's still served in dev, and the fidelity tests get the cookie through the shared `storageState`. Nothing is exempt except the paths listed above.
- **Delay:** only wrong codes are delayed. The response already says whether the code was right, so timing reveals nothing extra.
- **`Secure`:** set only when `NODE_ENV === 'production'`. Running the tests against a production build over plain http is out of scope.
- **Missing `APP_PASSCODE`:** `app/unlock/page.tsx` (a server component) checks it and renders a "Passcode not configured" card with no input. `/api/unlock` returns 503 in the same case.
- **While checking and after success:** the input is read-only and loses focus. Focus moves to the key when it appears.

## Accepted risk

A 2-digit code has 100 possibilities. Even with the 600 ms delay, a script can find it in about a minute. On Vercel's stateless functions, a real lockout would need an external store, which is out of scope. The user's stated goal is keeping casual visitors out, which this does. If the app ever needs real protection, the fix is a longer code plus a rate-limit store; nothing else in this design needs to change.

## Out of scope / left to the builder

- Exact file names and component breakdown inside `app/unlock/`.
- Whether to keep the mockup's `Replay` button. It is a mockup-only control and should **not** ship.
