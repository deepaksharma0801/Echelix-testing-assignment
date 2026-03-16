/**
 * tests/passwordReset.spec.ts
 * ────────────────────────────
 * End-to-end password-reset workflow for the Echelix POC.
 *
 * Test 1 – Happy path (5 steps)
 *   Step 1  POST /api/users/reset-password  (API trigger via UserApiClient)
 *   Step 2  Poll Gmail inbox until reset email arrives  (GmailService)
 *   Step 3  Extract reset URL from email body  (emailParser)
 *   Step 4  Navigate to URL → fill new password → submit  (ResetPasswordPage POM)
 *   Step 5  Log in with new password → assert /dashboard  (LoginPage POM)
 *
 * Test 2 – Negative: unknown email
 *   API trigger with an unregistered address should return 2xx (security pattern).
 *
 * Test 3 – Negative: invalid token
 *   Navigating directly to /reset-password?token=BADTOKEN should show an error alert.
 */

import { test, expect } from '@playwright/test';
import { UserApiClient } from '../api/userApiClient';
import { waitForResetEmail } from '../services/gmailService';
import { LoginPage } from '../pages/loginPage';
import { ResetPasswordPage } from '../pages/resetPasswordPage';

// ─── Module-level shared state ────────────────────────────────────────────────
// Declared at module scope so they can be written in Test 1 and read in
// subsequent steps.  Module-level variables are type-safe and ESLint-compatible
// (avoids the no-explicit-any cast required for test.info().annotations).

let sentAfter: number;
let resetLink: string;

// ─── Required environment variable guard ──────────────────────────────────────

const REQUIRED_VARS = [
  'BASE_URL',
  'API_BASE_URL',
  'API_KEY',
  'TEST_USER_EMAIL',
  'TEST_USER_CURRENT_PASSWORD',
  'TEST_USER_NEW_PASSWORD',
] as const;

test.beforeAll(() => {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `[passwordReset.spec] Missing required env vars: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in all values before running tests.'
    );
  }
});

// ─── Test 1: Full happy path ───────────────────────────────────────────────────

test('password reset – full happy path', async ({ page, request }) => {
  const email       = process.env['TEST_USER_EMAIL']!;
  const newPassword = process.env['TEST_USER_NEW_PASSWORD']!;

  // ── Step 1: API trigger ───────────────────────────────────────────────────
  sentAfter = Date.now();
  const apiClient = new UserApiClient(request);
  const apiResponse = await apiClient.triggerPasswordReset(email);

  expect(
    apiResponse.ok,
    `Expected 2xx from POST /api/users/reset-password but got HTTP ${apiResponse.status}. ` +
    'Is the mock server running? npx ts-node mock/server.ts'
  ).toBe(true);

  // ── Step 2 & 3: Email retrieval + link extraction ─────────────────────────
  // RESET_LINK_OVERRIDE bypasses Gmail entirely (no OAuth credentials needed).
  // Remove / leave blank once real Gmail credentials are configured.
  if (process.env['RESET_LINK_OVERRIDE']) {
    resetLink = process.env['RESET_LINK_OVERRIDE'];
    console.log('[spec] Using RESET_LINK_OVERRIDE:', resetLink);
  } else {
    const result = await waitForResetEmail('reset', sentAfter);
    resetLink = result.resetLink;
    console.log('[spec] Extracted reset link from Gmail:', resetLink);
  }

  expect(resetLink, 'Reset link must not be empty').toBeTruthy();
  expect(resetLink, 'Reset link must contain "reset-password"').toContain('reset-password');

  // ── Step 4: UI – navigate to reset URL, fill new password, submit ─────────
  const resetPage = new ResetPasswordPage(page);
  await resetPage.goto(resetLink);
  await resetPage.assertPageLoaded();
  await resetPage.resetPassword(newPassword);
  await resetPage.assertResetSuccess();

  // ── Step 5: Login with new password, assert dashboard ────────────────────
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, newPassword);
  await loginPage.assertLoginSuccess();
});

// ─── Test 2: Negative – unknown email ────────────────────────────────────────

test('password reset – unknown email returns non-500 (security pattern)', async ({ request }) => {
  const apiClient = new UserApiClient(request);
  const response = await apiClient.triggerPasswordReset('no-such-user@example.com');

  // Server must not return 5xx; 2xx preferred (does not reveal email existence)
  expect(
    response.status,
    `Expected 2xx status for unknown email, got ${response.status}`
  ).toBeGreaterThanOrEqual(200);

  expect(
    response.status,
    `Expected non-500 status for unknown email, got ${response.status}`
  ).toBeLessThan(500);
});

// ─── Test 3: Negative – invalid reset token ───────────────────────────────────

test('password reset – invalid token shows error alert', async ({ page }) => {
  const baseUrl = process.env['BASE_URL']!;
  const resetPage = new ResetPasswordPage(page);

  await resetPage.goto(`${baseUrl}/reset-password?token=INVALID-TOKEN-00000000`);
  await resetPage.assertValidationError();
});
