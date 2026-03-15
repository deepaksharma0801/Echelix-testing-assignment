import { APIRequestContext } from '@playwright/test';

interface ResetPasswordResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

/**
 * API client for user-related endpoints.
 * Uses Playwright's built-in APIRequestContext so all requests
 * share the same base URL and auth headers configured in playwright.config.ts.
 */
export class UserApiClient {
  private readonly request: APIRequestContext;
  private readonly apiKey: string;

  constructor(request: APIRequestContext) {
    this.request = request;
    this.apiKey = process.env.API_KEY ?? '';
    if (!this.apiKey) {
      throw new Error('API_KEY env var is not set');
    }
  }

  /**
   * POST /api/users/reset-password
   * Triggers the password reset flow for the given email.
   * Returns the raw status and parsed body for assertion in the spec.
   */
  async triggerPasswordReset(email: string): Promise<ResetPasswordResponse> {
    const response = await this.request.post(
      `${process.env.API_BASE_URL}/api/users/reset-password`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        data: { email },
      }
    );

    const body = await response.json().catch(() => null);

    return {
      status: response.status(),
      ok: response.ok(),
      body,
    };
  }
}
