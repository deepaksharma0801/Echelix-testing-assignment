# Playwright TypeScript POC — Password Reset Workflow

> **Take-home assessment submission.**
> This project demonstrates Playwright as a unified automation framework capable of validating API calls, UI interactions, and asynchronous email notifications within a single end-to-end test workflow.

---

## What This Project Proves

This POC validates all five success criteria from the assignment:

| # | Criterion | Implementation |
|---|---|---|
| 1 | Playwright triggers backend API operations | `api/userApiClient.ts` → `POST /api/users/reset-password` |
| 2 | Email notification is retrieved automatically | `services/gmailService.ts` → Gmail OAuth2 inbox poller |
| 3 | Email content parsed to extract reset link | `utils/emailParser.ts` → Base64url decode + dual-strategy regex |
| 4 | UI automation completes password reset workflow | `pages/resetPasswordPage.ts` → Page Object Model |
| 5 | User login succeeds with updated credentials | `pages/loginPage.ts` → Page Object Model + `assertLoginSuccess()` |

---

## End-to-End Flow

```
npm test
  │
  ├── 1. POST /api/users/reset-password        ← UserApiClient (Playwright APIRequestContext)
  │         │
  │         ▼
  ├── 2. Mock server generates UUID token
  │         │
  │         ▼
  ├── 3. nodemailer sends REAL email to Gmail inbox
  │         │
  │         ▼
  ├── 4. GmailService polls inbox every 3s (up to 60s)
  │         │
  │         ▼
  ├── 5. emailParser extracts reset link (Base64url → regex)
  │         │
  │         ▼
  ├── 6. Playwright navigates to reset link, fills form, submits
  │         │
  │         ▼
  └── 7. Playwright logs in with new password → assertLoginSuccess()
```

---

## Project Structure

```
playwright-poc/
├── api/
│   └── userApiClient.ts        # Layer 2 – Typed API client using Playwright's APIRequestContext
├── services/
│   └── gmailService.ts         # Layer 3 – Gmail OAuth2 inbox poller with retry + sentAfter guard
├── utils/
│   └── emailParser.ts          # Layer 4 – Base64url decoder, HTML stripper, dual-strategy link extractor
├── pages/
│   ├── loginPage.ts            # Layer 5 – Login POM: goto, login, assertLoginSuccess, assertLoginError
│   └── resetPasswordPage.ts    # Layer 5 – Reset POM: goto, resetPassword, assertResetSuccess, assertValidationError
├── tests/
│   └── passwordReset.spec.ts   # Layer 6 – 3 tests: happy path + unknown email + invalid token
├── mock/
│   └── server.ts               # Layer 6 – Express backend: seeded user store, token registry, nodemailer SMTP
├── playwright.config.ts        # Layer 1 – Chromium only, 90s timeout, HTML report, trace on failure
├── tsconfig.json               # Strict TypeScript (ES2022, no implicit any)
├── .env.example                # All 14 required environment variables documented
└── .gitignore                  # Excludes .env, node_modules, test-results, playwright-report
```

---

## Architecture Decisions

### Why a local mock server?
The assignment requires testing a full `API → Email → UI` flow. Rather than depending on a live Echelix environment (which is not accessible), a local Express mock server replicates the exact same contract: it accepts `POST /api/users/reset-password`, generates a UUID token, and sends a **real email** via Gmail SMTP. This means the Gmail polling and parsing layers are exercised with genuine email payloads — not stubs.

### Why two Gmail credential sets?
- **Sending** (SMTP + App Password): simple, no OAuth scope needed, ideal for outbound-only mock server
- **Reading** (OAuth2 + Refresh Token): required by Gmail API for inbox polling — App Passwords cannot access the API

### Why `RESET_LINK_OVERRIDE`?
Allows running all 3 tests without Gmail credentials by manually injecting the reset link. This is the recommended mode for CI environments or reviewers who do not want to set up OAuth2.

### Why `sentAfter` guard in Gmail polling?
Without it, a stale reset email from a previous run could be matched by the poller, causing false positives. The guard filters to only emails received **after** the API call was made.

### Why strict TypeScript?
`tsconfig.json` enables `strict`, `noImplicitAny`, and `strictNullChecks`. This catches contract mismatches between layers at compile time rather than at runtime during a test run.

---

## Test Coverage

| Test | Type | What it proves |
|---|---|---|
| `password reset – full happy path` | E2E | All 5 success criteria in sequence |
| `password reset – unknown email returns non-500` | Negative / API | API does not leak server errors for unknown users |
| `password reset – invalid token shows error alert` | Negative / UI | UI handles tampered/expired tokens gracefully |

---

## Getting Started

### Prerequisites
- Node.js 20 LTS or higher
- npm 10+
- A Gmail account with 2-Step Verification enabled

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Copy the secrets template and fill in your values
cp .env.example .env
```

### Run the Tests

```bash
# Headless (default)
npm test

# Headed — watch the browser automate
npm run test:headed

# Open HTML report after a run
npm run test:report
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values. Never commit `.env` — it is in `.gitignore`.

| Variable | Required | Description |
|---|---|---|
| `BASE_URL` | ✅ | App base URL (e.g. `http://localhost:3000`) |
| `API_BASE_URL` | ✅ | API base URL |
| `API_KEY` | ✅ | Bearer token for API requests |
| `TEST_USER_EMAIL` | ✅ | Gmail address used as the test account |
| `TEST_USER_CURRENT_PASSWORD` | ✅ | Password before the reset |
| `TEST_USER_NEW_PASSWORD` | ✅ | Password to set during the reset |
| `GMAIL_CLIENT_ID` | ✅ | OAuth2 Client ID — for **reading** inbox via Gmail API |
| `GMAIL_CLIENT_SECRET` | ✅ | OAuth2 Client Secret — for **reading** inbox |
| `GMAIL_REFRESH_TOKEN` | ✅ | OAuth2 Refresh Token — for **reading** inbox |
| `GMAIL_USER` | ✅ | Gmail address to poll |
| `GMAIL_SMTP_USER` | ✅ | Gmail address for **sending** reset emails |
| `GMAIL_SMTP_APP_PASSWORD` | ✅ | Gmail App Password (16 chars) — for **sending** |
| `MOCK_PORT` | Optional | Port for mock server (default: `3000`) |
| `RESET_LINK_OVERRIDE` | Optional | Bypass Gmail — paste a token URL to skip email polling |

### Quick local test (no Gmail OAuth needed)

> This is the **recommended mode for reviewers**. No Gmail credentials required.

**Step 1 — Install dependencies and browser**
```bash
npm install
npx playwright install chromium
```

**Step 2 — Set up environment**
```bash
cp .env.example .env
```
Open `.env` and set these minimum values:
```
BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000
API_KEY=mock-key-123
TEST_USER_EMAIL=your-email@gmail.com
TEST_USER_CURRENT_PASSWORD=OldPassword123!
TEST_USER_NEW_PASSWORD=NewPassword456!
```
> ⚠️ On macOS/zsh use **single quotes** for values containing `!` when exporting in terminal

**Step 3 — Open two terminals**

_Terminal 1 — start the mock server:_
```bash
npx ts-node mock/server.ts
```
✅ Wait for: `[mock] Server running at http://localhost:3000`

_Terminal 2 — trigger a reset token:_
```bash
curl -s -X POST http://localhost:3000/api/users/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com"}'
```
Copy the token URL printed in Terminal 1:
```
[mock] Reset token for ...: http://localhost:3000/reset-password?token=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
```

**Step 4 — Run tests**
```bash
export RESET_LINK_OVERRIDE="http://localhost:3000/reset-password?token=PASTE-TOKEN-HERE"
export BASE_URL="http://localhost:3000"
export API_BASE_URL="http://localhost:3000"
export TEST_USER_EMAIL="your-email@gmail.com"
export TEST_USER_CURRENT_PASSWORD='OldPassword123!'
export TEST_USER_NEW_PASSWORD='NewPassword456!'
npm test
```

**Step 5 — View the HTML report**
```bash
npm run test:report
```

✅ Expected result:
```
  ✓  password reset – full happy path
  ✓  password reset – unknown email returns non-500 (security pattern)
  ✓  password reset – invalid token shows error alert

  3 passed
```

> **Note:** Each token is single-use. Generate a fresh token before every `npm test` run.

---

### Why clicking the email link manually shows "Invalid or Expired Link"

This is **expected behaviour**, not a bug.

Reset tokens are **single-use by design** — once the link is clicked (by anyone or anything), the token is deleted from memory so it cannot be reused.

When you run `npm test`, Playwright automatically clicks the link as part of the happy-path test. By the time you open Gmail and click the same link yourself, the token is already gone → "Invalid or Expired Link".

```
npm test runs
  │
  ├── Playwright uses token abc-123 to complete the reset ✅
  │         → token abc-123 DELETED
  │
You click the email link in Gmail
  └── Server looks up abc-123 → not found → "Invalid or Expired Link" ❌
```

**To manually click the reset link yourself** (without running the tests), generate a fresh token using `curl`:

```bash
# Terminal 1 — server must be running
npx ts-node mock/server.ts

# Terminal 2 — send yourself a fresh email
curl -s -X POST http://localhost:3000/api/users/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com"}'
```

Check your Gmail inbox → click the link → the reset form opens correctly ✅
The token is untouched because no test has consumed it.

---

### Preview the UI locally

With the mock server running, open these in your browser:

| Page | URL |
|---|---|
| Login | http://localhost:3000/login |
| Forgot Password | http://localhost:3000/forgot-password |
| Dashboard | http://localhost:3000/dashboard |

---

## Reporting

Playwright generates a full HTML report after every run:

```bash
npm run test:report
```

On failure, the following artifacts are saved automatically to `test-results/`:
- `screenshot.png` — screenshot at point of failure
- `trace.zip` — full Playwright trace (open with `npx playwright show-trace`)
- `video.webm` — full video recording of the test run
