# Playwright POC – Password Reset Workflow

> **Echelix Test Automation Take-Home Assessment**

A Playwright + TypeScript proof-of-concept demonstrating a unified automation framework
capable of validating **API**, **UI**, and **asynchronous email** events within a single
end-to-end test workflow.

---

## Workflow Under Test

```
POST /api/users/reset-password
        │
        ▼
  Gmail inbox receives reset email
        │
        ▼
  Parse reset link from email body
        │
        ▼
  Playwright opens reset link → fills new password
        │
        ▼
  Verify login succeeds with new credentials
```

---

## Project Structure

```
playwright-poc/
├── tests/
│   └── passwordReset.spec.ts   # E2E test orchestrating the full workflow
├── api/
│   └── userApiClient.ts        # Playwright APIRequestContext wrapper for system API
├── pages/
│   ├── loginPage.ts            # Page Object Model – login screen
│   └── resetPasswordPage.ts    # Page Object Model – password reset screen
├── services/
│   └── gmailService.ts         # Gmail API OAuth2 client + email polling
├── utils/
│   └── emailParser.ts          # Extract reset link from raw email body
└── playwright.config.ts        # Runner, reporter, and project configuration
```

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | 20 LTS |
| npm | 10+ |

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Copy the secrets template and fill in real values
cp .env.example .env
# Edit .env – see "Environment Variables" section below
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in every value.

| Variable | Purpose |
|----------|---------|
| `BASE_URL` | Root URL of the application under test |
| `API_BASE_URL` | Base URL for REST API calls |
| `API_KEY` | Bearer token / API key |
| `TEST_USER_EMAIL` | Gmail address that receives the reset email |
| `TEST_USER_CURRENT_PASSWORD` | Password before the reset |
| `TEST_USER_NEW_PASSWORD` | Password set during the reset |
| `GMAIL_CLIENT_ID` | Google OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | Google OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | Long-lived refresh token for the test Gmail account |
| `GMAIL_USER` | Gmail address associated with the OAuth credentials |

> **Never commit `.env`** – it is listed in `.gitignore`.

---

## Running the Tests

```bash
# Headless (default)
npm test

# Headed (watch the browser)
npm run test:headed

# Open the HTML report after a run
npm run test:report

# TypeScript type-check only (no emit)
npm run typecheck
```

---

## Reporting

Playwright HTML report is written to `playwright-report/`. Open it with:

```bash
npx playwright show-report
```

Traces, screenshots, and videos are captured on failure and stored under `test-results/`.

---

## Gmail API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Desktop application type).
3. Enable the **Gmail API** for the project.
4. Run the one-time OAuth consent flow to obtain a `refresh_token`.
5. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` in `.env`.

---

## License

Private – submitted for assessment purposes only.
