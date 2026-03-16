import { google } from 'googleapis';

/**
 * GmailHelper
 * -----------
 * Authenticates with Gmail using OAuth2 (refresh-token flow) and polls the
 * inbox until a password-reset email arrives.  The reset link is extracted
 * from the plain-text / HTML body and returned to the caller.
 *
 * All credentials are read from environment variables – nothing is hardcoded.
 */

const POLL_INTERVAL_MS  = 3_000;   // check every 3 s
const MAX_ATTEMPTS      = 20;       // give up after ~60 s total
const RESET_LINK_REGEX  = /https?:\/\/\S+reset\S*/i;

export interface ResetEmailResult {
  messageId: string;
  resetLink: string;
}

function buildOAuthClient() {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Gmail OAuth env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN'
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

/**
 * Poll the Gmail inbox until a message matching `subject` (substring, case-
 * insensitive) arrives after `afterEpochMs`, then extract and return the
 * first reset URL found in the body.
 *
 * OVERRIDE MODE: if RESET_LINK_OVERRIDE is set in .env, Gmail is skipped
 * entirely and that URL is returned directly.  Useful for local POC runs
 * where Gmail OAuth credentials are not yet configured.
 */
export async function waitForResetEmail(
  subjectKeyword: string,
  afterEpochMs: number
): Promise<ResetEmailResult> {
  // ── Override / mock mode ─────────────────────────────────────────────────
  const override = process.env.RESET_LINK_OVERRIDE;
  if (override) {
    console.warn(
      '[gmailHelper] RESET_LINK_OVERRIDE is set – skipping Gmail and using override URL.'
    );
    return { messageId: 'override', resetLink: override };
  }
  // ─────────────────────────────────────────────────────────────────────────

  const auth   = buildOAuthClient();
  const gmail  = google.gmail({ version: 'v1', auth });
  const userId = process.env.GMAIL_USER ?? 'me';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Search for unread messages with matching subject received after trigger
    const query = `subject:${subjectKeyword} is:unread after:${Math.floor(afterEpochMs / 1000)}`;

    const listRes = await gmail.users.messages.list({ userId, q: query, maxResults: 10 });
    const messages = listRes.data.messages ?? [];

    if (messages.length > 0) {
      for (const message of messages) {
        const msgId  = message.id!;
        const msgRes = await gmail.users.messages.get({ userId, id: msgId, format: 'full' });

        // Gmail `after:` only filters by day — use internalDate for precise time check
        // internalDate is in ms but rounded to second boundary, so compare at second granularity
        const internalDate = Number(msgRes.data.internalDate ?? 0);
        if (Math.floor(internalDate / 1000) < Math.floor(afterEpochMs / 1000)) {
          console.log(`[gmailService] Skipping stale email (internalDate=${internalDate} < afterEpochMs=${afterEpochMs})`);
          continue;
        }

        const payload = msgRes.data.payload;
        const body = extractBody(payload);
        const match = body.match(RESET_LINK_REGEX);

        if (match) {
          console.log(`[gmailService] Found reset link: ${match[0]}`);
          console.log(`[gmailService] Email internalDate: ${internalDate}, afterEpochMs: ${afterEpochMs}`);

          // Trash the email so it cannot be reused in any future run
          await gmail.users.messages.trash({ userId, id: msgId });

          return { messageId: msgId, resetLink: match[0] };
        }
      }
    }

    // Not found yet – wait and retry
    if (attempt < MAX_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    `Reset email with subject "${subjectKeyword}" not found after ${MAX_ATTEMPTS} attempts (~${(MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s).`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Recursively walks the MIME payload tree and returns decoded text content
 * (prefers text/plain, falls back to text/html).
 */
function extractBody(payload: any): string {
  if (!payload) return '';

  // Direct body data on this part
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Multipart – walk parts, prefer text/plain
  if (payload.parts && Array.isArray(payload.parts)) {
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plain?.body?.data) {
      return Buffer.from(plain.body.data, 'base64url').toString('utf-8');
    }

    const html = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (html?.body?.data) {
      return Buffer.from(html.body.data, 'base64url').toString('utf-8');
    }

    // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}
