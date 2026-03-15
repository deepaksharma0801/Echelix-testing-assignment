import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model – Login page.
 * Encapsulates all selectors and actions for the login UI.
 * No assertions here; assertions belong in the test spec.
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
    this.emailInput      = page.getByLabel(/email/i);
    this.passwordInput   = page.getByLabel(/password/i);
    this.submitButton    = page.getByRole('button', { name: /log in|sign in/i });
    this.errorMessage    = page.getByRole('alert');
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

  /** Returns true when the post-login success indicator is visible. */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.successIndicator.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}
