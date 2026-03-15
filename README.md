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

## Project Structure (current)

```
playwright-poc/
├── api/
│   └── userApiClient.ts       # POST /api/users/reset-password
├── pages/
│   ├── loginPage.ts           # Login form POM
│   └── resetPasswordPage.ts   # Reset password form POM
└── playwright.config.ts       # Playwright configuration
```

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running tests.

| Variable | Description |
|---|---|
| `BASE_URL` | App base URL |
| `API_BASE_URL` | API base URL |
| `API_KEY` | Bearer token for API requests |
| `TEST_USER_EMAIL` | Test account email |
| `TEST_USER_CURRENT_PASSWORD` | Current password (pre-reset) |
| `TEST_USER_NEW_PASSWORD` | New password (post-reset) |
| `GMAIL_CLIENT_ID` | Gmail OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth refresh token |
| `GMAIL_USER` | Gmail address to poll |
