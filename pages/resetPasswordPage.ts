import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model – Password Reset page.
 * Handles the form reached via the reset link extracted from the email.
 * No assertions here; assertions belong in the test spec.
 */
export class ResetPasswordPage {
  readonly page: Page;

  // Locators
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPasswordInput     = page.getByLabel(/new password/i);
    this.confirmPasswordInput = page.getByLabel(/confirm password/i);
    this.submitButton         = page.getByRole('button', { name: /reset|submit|save/i });
    this.successMessage       = page.getByText(/password.*reset|password.*updated|success/i);
    this.errorMessage         = page.getByRole('alert');
  }

  /**
   * Navigate directly to the reset URL extracted from the email.
   * The full URL is used as-is (it contains the one-time token).
   */
  async goto(resetUrl: string): Promise<void> {
    await this.page.goto(resetUrl);
  }

  /** Fill and submit the new password form. */
  async resetPassword(newPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(newPassword);
    await this.submitButton.click();
  }

  /** Returns true when the success confirmation is visible. */
  async isResetSuccessful(): Promise<boolean> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}
