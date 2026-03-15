# Playwright POC – Password Reset Workflow

## Getting Started

### Prerequisites
- Node.js 20 LTS or higher
- npm 10+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Copy the secrets template and fill in real values
cp .env.example .env
```

### Run the Tests

```bash
# Headless
npm test

# Headed (watch the browser)
npm run test:headed

# Open HTML report after a run
npm run test:report
```

---

## Project Structure

```
playwright-poc/
├── api/
│   └── userApiClient.ts       # Layer 2 – POST /api/users/reset-password
├── services/
│   └── gmailService.ts        # Layer 3 – Gmail OAuth2 inbox poller
├── utils/
│   └── emailParser.ts         # Layer 4 – extracts reset link from email body
├── pages/
│   ├── loginPage.ts           # Layer 5 – login form POM + assertions
│   └── resetPasswordPage.ts   # Layer 5 – reset password form POM + assertions
├── tests/
│   └── passwordReset.spec.ts  # Layer 6 – 3 tests (happy path + 2 negatives)
├── mock/
│   └── server.ts              # Layer 6 – Express mock backend (sends real email)
└── playwright.config.ts       # Layer 1 – Playwright configuration
```

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running tests.

| Variable | Description |
|---|---|
| `BASE_URL` | App base URL (e.g. `http://localhost:3000`) |
| `API_BASE_URL` | API base URL |
| `API_KEY` | Bearer token for API requests |
| `TEST_USER_EMAIL` | Test account email |
| `TEST_USER_CURRENT_PASSWORD` | Current password (pre-reset) |
| `TEST_USER_NEW_PASSWORD` | New password (post-reset) |
| `GMAIL_CLIENT_ID` | Gmail OAuth client ID (for **reading** inbox) |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth client secret (for **reading** inbox) |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth refresh token (for **reading** inbox) |
| `GMAIL_USER` | Gmail address to poll |
| `GMAIL_SMTP_USER` | Gmail address for **sending** via SMTP |
| `GMAIL_SMTP_APP_PASSWORD` | Gmail App Password 16-char (for **sending**) |
| `MOCK_PORT` | Port for the local mock server (default `3000`) |
| `RESET_LINK_OVERRIDE` | Skip Gmail — paste a token URL here for local testing |
