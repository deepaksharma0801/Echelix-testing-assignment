import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model – Login page.
 * Encapsulates all selectors and actions for the login UI.
 * Assertion methods live here so the spec stays readable.
 *
 * Selector strategy (3 fallback levels):
 *   1. data-testid   – most stable, survives CSS refactors
 *   2. ARIA role     – semantic, framework-agnostic
 *   3. CSS attribute – last resort
 */
export class LoginPage {
  readonly page: Page;

  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput       = page.locator('[data-testid="login-email"]').or(page.getByLabel(/email/i));
    this.passwordInput    = page.locator('[data-testid="login-password"]').or(page.getByLabel(/password/i));
    this.submitButton     = page.locator('[data-testid="login-submit"]').or(page.getByRole('button', { name: /log in|sign in/i }));
    this.errorMessage     = page.locator('[data-testid="login-error"]').or(page.getByRole('alert'));
    this.successIndicator = page.getByRole('heading', { name: /dashboard|welcome|home/i });
  }

  /** Navigate to the login page. */
  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  /** Fill credentials and submit the login form. */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Assert that login succeeded: URL left /login and dashboard heading is visible. */
  async assertLoginSuccess(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/i, { timeout: 15_000 });
    await expect(this.successIndicator).toBeVisible({ timeout: 15_000 });
  }

  /** Assert that login failed: error alert is visible. */
  async assertLoginError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 10_000 });
  }

  /** Returns true when the post-login success indicator is visible (non-throwing helper). */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.successIndicator.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}
