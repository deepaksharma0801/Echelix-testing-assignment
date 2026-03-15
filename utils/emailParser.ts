/**
 * emailParser.ts
 * ---------------
 * Pure utility functions for decoding and parsing password-reset emails.
 * No side effects, no I/O — all functions are deterministic and unit-testable.
 */

/**
 * Converts a Base64url-encoded string to a UTF-8 string.
 * Gmail encodes message bodies in Base64url (uses `-` and `_` instead of `+` and `/`).
 */
export function decodeBase64Url(encoded: string): string {
  // Normalise Base64url → standard Base64
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Strips all HTML tags from a string, returning plain text.
 * Used as a fallback when href-attribute extraction fails.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the password-reset URL from email HTML content.
 *
 * Two-strategy approach (redundant by design — email clients mangle HTML unpredictably):
 *   Strategy 1 — href attribute regex: works on well-formed HTML with anchor tags.
 *   Strategy 2 — bare URL regex on stripped plain text: fallback for plain-text or broken HTML.
 *
 * @param html     Raw HTML (or plain text) of the email body.
 * @param fragment URL fragment that identifies a reset link (e.g. "reset-password").
 * @returns The reset URL string, or null if not found.
 */
export function extractResetLink(html: string, fragment: string): string | null {
  // Strategy 1: href="...reset-password..." attribute
  const hrefRegex = new RegExp(`href="([^"]*${fragment}[^"]*)"`, 'i');
  const hrefMatch = html.match(hrefRegex);
  if (hrefMatch) return hrefMatch[1];

  // Strategy 2: bare URL containing the fragment (works on plain text fallback)
  const urlRegex = new RegExp(`https?:\\/\\/\\S*${fragment}\\S*`, 'i');
  const urlMatch = stripHtml(html).match(urlRegex);
  if (urlMatch) return urlMatch[0];

  return null;
}

/**
 * Orchestrates decode → extract → throw.
 * Accepts a raw Base64url-encoded email body, decodes it, then extracts the reset link.
 *
 * @param rawBody  Base64url-encoded email body string (as returned by Gmail API).
 * @param fragment URL fragment to search for (e.g. "reset-password").
 * @returns The reset URL string.
 * @throws  Error if no matching link is found after decoding.
 */
export function parseEmailBody(rawBody: string, fragment: string): string {
  const decoded = decodeBase64Url(rawBody);
  const link = extractResetLink(decoded, fragment);
  if (!link) {
    throw new Error(
      `No reset link containing "${fragment}" found in email body.`
    );
  }
  return link;
}
