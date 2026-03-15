/**
 * mock/server.ts
 * ──────────────
 * Local Express server that simulates the Echelix backend.
 * Lets the full password-reset test suite run without real infrastructure.
 *
 * Routes
 * ──────
 *  GET  /login                     – serves the login form HTML
 *  POST /api/login                 – validates credentials → redirects to /dashboard
 *  GET  /dashboard                 – landing page after successful login
 *  GET  /reset-password?token=X    – serves the reset-password form HTML
 *  POST /reset-password            – updates the in-memory password store
 *  POST /api/users/reset-password  – generates a UUID token + sends a REAL email via Gmail SMTP
 *
 * Auth mechanisms (two deliberately separate paths)
 * ──────────────────────────────────────────────────
 *  Sending  – Gmail SMTP + App Password (nodemailer)    → GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD
 *  Reading  – Gmail API OAuth2 (googleapis)             → GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── In-memory stores ─────────────────────────────────────────────────────────

const users: Record<string, string> = {
  [process.env['TEST_USER_EMAIL'] ?? 'test@example.com']:
    process.env['TEST_USER_CURRENT_PASSWORD'] ?? 'InitialPass123!',
};

const resetTokens: Record<string, string> = {};   // token → email

// ─── Nodemailer transporter (Gmail SMTP + App Password) ───────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['GMAIL_SMTP_USER'],
    pass: process.env['GMAIL_SMTP_APP_PASSWORD'],
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /login – login form */
app.get('/login', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Login</title></head>
<body>
  <h1>Login</h1>
  <form method="POST" action="/api/login">
    <label for="email">Email</label>
    <input id="email"    data-testid="login-email"    type="email"    name="email"    required />
    <label for="password">Password</label>
    <input id="password" data-testid="login-password" type="password" name="password" required />
    <button data-testid="login-submit" type="submit">Log In</button>
  </form>
</body>
</html>`);
});

/** POST /api/login – validates credentials, redirects to /dashboard on success */
app.post('/api/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const stored = users[email];

  if (!stored || stored !== password) {
    res.status(401).send(`<!DOCTYPE html>
<html lang="en"><body>
  <div data-testid="login-error" role="alert">Invalid email or password.</div>
  <a href="/login">Try again</a>
</body></html>`);
    return;
  }

  res.redirect('/dashboard');
});

/** GET /dashboard – shown after a successful login */
app.get('/dashboard', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en"><body>
  <h1>Dashboard</h1>
  <p>Welcome back!</p>
</body></html>`);
});

/** GET /reset-password?token=X – reset-password form (validates token first) */
app.get('/reset-password', (req: Request, res: Response) => {
  const token = req.query['token'] as string | undefined;
  const email = token ? resetTokens[token] : undefined;

  if (!email) {
    res.status(400).send(`<!DOCTYPE html>
<html lang="en"><body>
  <div data-testid="reset-error" role="alert">Invalid or expired reset token.</div>
</body></html>`);
    return;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Reset Password</title></head>
<body>
  <h1>Reset Password</h1>
  <form data-testid="reset-form" method="POST" action="/reset-password">
    <input type="hidden" name="token" value="${token}" />
    <label for="new-password">New Password</label>
    <input id="new-password"     data-testid="new-password"     type="password" name="newPassword"     required />
    <label for="confirm-password">Confirm Password</label>
    <input id="confirm-password" data-testid="confirm-password" type="password" name="confirmPassword" required />
    <button data-testid="reset-submit" type="submit">Reset Password</button>
  </form>
</body>
</html>`);
});

/** POST /reset-password – updates the in-memory password store */
app.post('/reset-password', (req: Request, res: Response) => {
  const { token, newPassword, confirmPassword } = req.body as {
    token: string;
    newPassword: string;
    confirmPassword: string;
  };

  const email = resetTokens[token];
  if (!email) {
    res.status(400).send(`<!DOCTYPE html>
<html lang="en"><body>
  <div data-testid="reset-error" role="alert">Invalid or expired reset token.</div>
</body></html>`);
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).send(`<!DOCTYPE html>
<html lang="en"><body>
  <div data-testid="reset-error" role="alert">Passwords do not match.</div>
</body></html>`);
    return;
  }

  users[email] = newPassword;
  delete resetTokens[token];

  res.send(`<!DOCTYPE html>
<html lang="en"><body>
  <div data-testid="reset-success">Password reset successfully. <a href="/login">Log in</a></div>
</body></html>`);
});

/**
 * POST /api/users/reset-password
 * 1. Accepts { email }
 * 2. Generates a UUID token, stores token → email
 * 3. Sends a real email with the reset link via Gmail SMTP (nodemailer)
 * 4. Always returns 200 (security pattern – does not reveal whether email exists)
 */
app.post('/api/users/reset-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const baseUrl = process.env['BASE_URL'] ?? 'http://localhost:3000';

  // Security: respond identically whether or not the email is registered
  if (!email || !users[email]) {
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    return;
  }

  const token = crypto.randomUUID();
  resetTokens[token] = email;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  try {
    await transporter.sendMail({
      from: process.env['GMAIL_SMTP_USER'],
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset for your account.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>Or copy this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
      `,
    });

    console.log(`[mock] Reset email sent to ${email}: ${resetUrl}`);
    res.json({ success: true, message: 'Reset email sent.' });
  } catch (err) {
    // Clean up token so it cannot be reused after a send failure
    delete resetTokens[token];
    console.error('[mock] Email send failed:', err);
    res.status(500).json({ success: false, message: 'Failed to send reset email.' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['MOCK_PORT'] ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`[mock] Server running at http://localhost:${PORT}`);
});
