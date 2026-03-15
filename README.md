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
