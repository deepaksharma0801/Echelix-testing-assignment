import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model – Password Reset page.
 * Handles the form reached via the reset link extracted from the email.
 * Assertion methods live here so the spec stays readable.
 *
 * Selector strategy (3 fallback levels):
 *   1. data-testid   – most stable, survives CSS refactors
 *   2. ARIA role     – semantic, framework-agnostic
 *   3. CSS attribute – last resort
 */
export class ResetPasswordPage {
  readonly page: Page;

  // Locators
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly resetForm: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPasswordInput     = page.locator('[data-testid="new-password"]').or(page.getByLabel(/new password/i));
    this.confirmPasswordInput = page.locator('[data-testid="confirm-password"]').or(page.getByLabel(/confirm password/i));
    this.submitButton         = page.locator('[data-testid="reset-submit"]').or(page.getByRole('button', { name: /reset|submit|save/i }));
    this.successMessage       = page.locator('[data-testid="reset-success"]').first();
    this.errorMessage         = page.locator('[data-testid="reset-error"]').or(page.getByRole('alert'));
    this.resetForm            = page.locator('form').or(page.locator('[data-testid="reset-form"]'));
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

  /** Assert the reset page loaded successfully (token is valid). */
  async assertPageLoaded(): Promise<void> {
    await expect(this.resetForm).toBeVisible({ timeout: 10_000 });
    await expect(this.newPasswordInput).toBeVisible({ timeout: 10_000 });
  }

  /** Assert that the password was reset successfully. */
  async assertResetSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout: 15_000 });
  }

  /** Assert that a validation/token error is shown (invalid or expired token). */
  async assertValidationError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 10_000 });
  }

  /** Returns true when the success confirmation is visible (non-throwing helper). */
  async isResetSuccessful(): Promise<boolean> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}
