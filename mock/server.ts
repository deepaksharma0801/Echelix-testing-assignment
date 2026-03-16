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
app.use(express.static(path.resolve(__dirname, '../public')));

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
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Login – Echelix</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      padding: 48px 40px 40px;
      width: 100%;
      max-width: 420px;
    }
    .brand {
      text-align: center;
      background: #000000;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 32px;
    }
    .brand p {
      font-size: 14px;
      color: #aaa;
      margin-top: 8px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 6px;
    }
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #dde1e7;
      border-radius: 7px;
      font-size: 14px;
      color: #222;
      outline: none;
      transition: border-color 0.2s;
      background: #fafbfc;
    }
    input:focus {
      border-color: #1a73e8;
      background: #fff;
    }
    .forgot {
      display: block;
      text-align: right;
      font-size: 12px;
      color: #1a73e8;
      text-decoration: none;
      margin-top: 4px;
    }
    .forgot:hover { text-decoration: underline; }
    button[type="submit"] {
      width: 100%;
      padding: 13px;
      background: #1a73e8;
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.2s;
    }
    button[type="submit"]:hover { background: #1558b0; }
    .divider {
      text-align: center;
      font-size: 12px;
      color: #bbb;
      margin: 20px 0 4px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #ccc;
      margin-top: 28px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Sign in to your account</p>
    </div>
    <form method="POST" action="/api/login">
      <div class="form-group">
        <label for="email">Email address</label>
        <input id="email" data-testid="login-email" type="email" name="email" placeholder="you@example.com" required />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input id="password" data-testid="login-password" type="password" name="password" placeholder="••••••••" required />
      </div>
      <button data-testid="login-submit" type="submit">Sign In</button>
      <div style="text-align:center; margin-top:16px;">
        <a href="/forgot-password" style="font-size:13px; color:#1a73e8; text-decoration:none;">Forgot password?</a>
      </div>
    </form>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
});

/** POST /api/login – validates credentials, redirects to /dashboard on success */
app.post('/api/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const stored = users[email];

  if (!stored || stored !== password) {
    res.status(401).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Login Failed – Echelix</title>
  <style>${cardPageStyles}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Sign in to your account</p>
    </div>
    <div style="text-align:center; padding: 8px 0 24px;">
      <div style="font-size:48px; margin-bottom:16px;">🔒</div>
      <h2 style="font-size:18px; color:#d93025; margin-bottom:12px;" data-testid="login-error" role="alert">Invalid Email or Password</h2>
      <p style="font-size:14px; color:#666; line-height:1.6;">
        The email or password you entered is incorrect. Please check your credentials and try again.
      </p>
    </div>
    <a href="/login" style="display:block; width:100%; padding:13px; background:#1a73e8; color:#fff; border:none; border-radius:7px; font-size:15px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none; margin-top:8px;">Try Again</a>
    <a class="back-link" href="/forgot-password">Forgot your password?</a>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
    return;
  }

  res.redirect('/dashboard');
});

/** GET /dashboard – shown after a successful login */
app.get('/dashboard', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dashboard – Echelix</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0f2f5; min-height: 100vh; }

    /* Navbar */
    .navbar {
      background: #000;
      padding: 0 40px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .navbar img { height: 32px; }
    .navbar-right { display: flex; align-items: center; gap: 20px; }
    .navbar-right span { color: #aaa; font-size: 13px; }
    .logout-btn {
      background: transparent;
      border: 1.5px solid #444;
      color: #fff;
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .logout-btn:hover { border-color: #fff; }

    /* Main */
    .main { max-width: 1100px; margin: 40px auto; padding: 0 24px; }

    .welcome-banner {
      background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
      border-radius: 12px;
      padding: 36px 40px;
      color: #fff;
      margin-bottom: 32px;
    }
    .welcome-banner h1 { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
    .welcome-banner p  { font-size: 15px; opacity: 0.85; }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: #fff;
      border-radius: 10px;
      padding: 28px 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }
    .stat-card .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
    .stat-card .value { font-size: 32px; font-weight: 700; color: #1a1a1a; }
    .stat-card .sub   { font-size: 12px; color: #1a73e8; margin-top: 6px; }

    /* Activity */
    .section-card {
      background: #fff;
      border-radius: 10px;
      padding: 28px 28px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }
    .section-card h2 { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; }
    .activity-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px;
      color: #444;
    }
    .activity-item:last-child { border-bottom: none; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #1a73e8; flex-shrink: 0; }
    .dot.green { background: #34a853; }
    .dot.orange { background: #fbbc05; }
    .time { margin-left: auto; font-size: 12px; color: #bbb; }

    .footer { text-align: center; font-size: 11px; color: #ccc; margin: 40px 0 24px; }
  </style>
</head>
<body>

  <!-- Navbar -->
  <nav class="navbar">
    <img src="/echelix-logo.png" alt="Echelix" />
    <div class="navbar-right">
      <span>saideepaksharma8@gmail.com</span>
      <button class="logout-btn" onclick="window.location.href='/login'">Sign Out</button>
    </div>
  </nav>

  <!-- Main Content -->
  <div class="main">

    <!-- Welcome Banner -->
    <div class="welcome-banner" data-testid="dashboard-banner">
      <h1>Welcome back!</h1>
      <p>Here&#x2019;s a summary of your account activity.</p>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Sessions</div>
        <div class="value">142</div>
        <div class="sub">↑ 12% this week</div>
      </div>
      <div class="stat-card">
        <div class="label">Last Login</div>
        <div class="value" style="font-size:20px; margin-top:4px;">Just now</div>
        <div class="sub">via Password Reset</div>
      </div>
      <div class="stat-card">
        <div class="label">Account Status</div>
        <div class="value" style="font-size:20px; color:#34a853; margin-top:4px;">Active</div>
        <div class="sub">All systems normal</div>
      </div>
    </div>

    <!-- Activity Feed -->
    <div class="section-card">
      <h2>Recent Activity</h2>
      <div class="activity-item">
        <span class="dot green"></span>
        <span>Password reset completed successfully</span>
        <span class="time">Just now</span>
      </div>
      <div class="activity-item">
        <span class="dot"></span>
        <span>Logged in from new session</span>
        <span class="time">1 min ago</span>
      </div>
      <div class="activity-item">
        <span class="dot orange"></span>
        <span>Password reset email requested</span>
        <span class="time">2 mins ago</span>
      </div>
      <div class="activity-item">
        <span class="dot"></span>
        <span>Previous session ended</span>
        <span class="time">10 mins ago</span>
      </div>
    </div>

  </div>

  <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>

</body>
</html>`);
});

// ─── Shared page styles helper ────────────────────────────────────────────────
const cardPageStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f0f2f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); padding: 48px 40px 40px; width: 100%; max-width: 420px; }
  .brand { text-align: center; background: #000; border-radius: 8px; padding: 20px; margin-bottom: 32px; }
  .brand p { font-size: 14px; color: #aaa; margin-top: 8px; }
  .form-group { margin-bottom: 18px; }
  label { display: block; font-size: 13px; font-weight: 600; color: #444; margin-bottom: 6px; }
  input[type="email"] { width: 100%; padding: 11px 14px; border: 1.5px solid #dde1e7; border-radius: 7px; font-size: 14px; color: #222; outline: none; transition: border-color 0.2s; background: #fafbfc; }
  input:focus { border-color: #1a73e8; background: #fff; }
  button[type="submit"] { width: 100%; padding: 13px; background: #1a73e8; color: #fff; border: none; border-radius: 7px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: background 0.2s; }
  button[type="submit"]:hover { background: #1558b0; }
  .footer { text-align: center; font-size: 11px; color: #ccc; margin-top: 28px; }
  .back-link { display: block; text-align: center; margin-top: 16px; font-size: 13px; color: #1a73e8; text-decoration: none; }
  .back-link:hover { text-decoration: underline; }
`;

/** GET /forgot-password – form to enter email */
app.get('/forgot-password', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Forgot Password – Echelix</title>
  <style>${cardPageStyles}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Reset your password</p>
    </div>
    <p style="font-size:14px; color:#666; margin-bottom:20px; line-height:1.6;">
      Enter the email address associated with your account and we will send you a link to reset your password.
    </p>
    <form method="POST" action="/forgot-password">
      <div class="form-group">
        <label for="email">Email address</label>
        <input id="email" data-testid="forgot-email" type="email" name="email" placeholder="you@example.com" required />
      </div>
      <button data-testid="forgot-submit" type="submit">Send Reset Link</button>
    </form>
    <a class="back-link" href="/login">← Back to Sign In</a>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
});

/** POST /forgot-password – generate token + send reset email */
app.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };

  // Security: silently redirect if email is not a registered user
  if (!email || !users[email]) {
    console.log(`[mock] Forgot-password: unknown email ${email} – silently redirecting`);
    res.redirect('/forgot-password/sent');
    return;
  }

  const token = crypto.randomUUID();
  resetTokens[token] = email;
  const resetUrl = `${process.env['BASE_URL'] ?? 'http://localhost:3000'}/reset-password?token=${token}`;
  console.log(`[mock] Forgot-password reset token for ${email}: ${resetUrl}`);

  try {
    await transporter.sendMail({
      from: `"Echelix Support" <${process.env['GMAIL_SMTP_USER']}>`,
      to: email,
      subject: 'Reset Your Password – Echelix',
      html: buildResetEmailHtml(resetUrl),
      text: `Reset your Echelix password: ${resetUrl}\n\nExpires in 1 hour.`,
    });
  } catch {
    console.warn(`[mock] SMTP not configured – reset link: ${resetUrl}`);
  }

  res.redirect('/forgot-password/sent');
});

/** GET /forgot-password/sent – confirmation page */
app.get('/forgot-password/sent', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Check Your Email – Echelix</title>
  <style>${cardPageStyles}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Check your inbox</p>
    </div>
    <div style="text-align:center; padding: 8px 0 24px;">
      <div style="font-size:48px; margin-bottom:16px;">📬</div>
      <h2 style="font-size:18px; color:#1a1a1a; margin-bottom:12px;">Reset link sent!</h2>
      <p style="font-size:14px; color:#666; line-height:1.6;">
        If that email address is registered, you will receive a password reset link shortly.
        Check your spam folder if you don&#x2019;t see it.
      </p>
    </div>
    <a class="back-link" href="/login">← Back to Sign In</a>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
});

/** GET /reset-password?token=X – reset-password form (validates token first) */
app.get('/reset-password', (req: Request, res: Response) => {
  const token = req.query['token'] as string | undefined;
  const email = token ? resetTokens[token] : undefined;

  if (!email) {
    res.status(400).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invalid Token – Echelix</title>
  <style>${cardPageStyles}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Something went wrong</p>
    </div>
    <div style="text-align:center; padding: 8px 0 24px;">
      <div style="font-size:48px; margin-bottom:16px;">⛔</div>
      <h2 style="font-size:18px; color:#d93025; margin-bottom:12px;" data-testid="reset-error" role="alert">Invalid or Expired Link</h2>
      <p style="font-size:14px; color:#666; line-height:1.6;">
        This password reset link is no longer valid. It may have already been used or has expired.
      </p>
    </div>
    <a href="/forgot-password" style="display:block; width:100%; padding:13px; background:#1a73e8; color:#fff; border:none; border-radius:7px; font-size:15px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none; margin-top:8px;">Request a New Link</a>
    <a class="back-link" href="/login">← Back to Sign In</a>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
    return;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Password – Echelix</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      padding: 48px 40px 40px;
      width: 100%;
      max-width: 420px;
    }
    .brand {
      text-align: center;
      margin-bottom: 32px;
    }
    .brand h1 { font-size: 26px; font-weight: 700; color: #1a73e8; letter-spacing: 0.5px; }
    .brand p  { font-size: 14px; color: #888; margin-top: 6px; }
    .form-group { margin-bottom: 18px; }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 6px;
    }
    input[type="password"] {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #dde1e7;
      border-radius: 7px;
      font-size: 14px;
      color: #222;
      outline: none;
      transition: border-color 0.2s;
      background: #fafbfc;
    }
    input:focus { border-color: #1a73e8; background: #fff; }
    button[type="submit"] {
      width: 100%;
      padding: 13px;
      background: #1a73e8;
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.2s;
    }
    button[type="submit"]:hover { background: #1558b0; }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #ccc;
      margin-top: 28px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Choose a new password</p>
    </div>
    <form data-testid="reset-form" method="POST" action="/reset-password">
      <input type="hidden" name="token" value="${token}" />
      <div class="form-group">
        <label for="new-password">New Password</label>
        <input id="new-password" data-testid="new-password" type="password" name="newPassword" placeholder="••••••••" required />
      </div>
      <div class="form-group">
        <label for="confirm-password">Confirm Password</label>
        <input id="confirm-password" data-testid="confirm-password" type="password" name="confirmPassword" placeholder="••••••••" required />
      </div>
      <button data-testid="reset-submit" type="submit">Reset Password</button>
    </form>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
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
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invalid Token – Echelix</title>
  <style>${cardPageStyles}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Something went wrong</p>
    </div>
    <div style="text-align:center; padding: 8px 0 24px;">
      <div style="font-size:48px; margin-bottom:16px;">⛔</div>
      <h2 style="font-size:18px; color:#d93025; margin-bottom:12px;" data-testid="reset-error" role="alert">Invalid or Expired Link</h2>
      <p style="font-size:14px; color:#666; line-height:1.6;">
        This password reset link is no longer valid. It may have already been used or has expired.
      </p>
    </div>
    <a href="/forgot-password" style="display:block; width:100%; padding:13px; background:#1a73e8; color:#fff; border:none; border-radius:7px; font-size:15px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none; margin-top:8px;">Request a New Link</a>
    <a class="back-link" href="/login">← Back to Sign In</a>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Passwords Do Not Match – Echelix</title>
  <style>${cardPageStyles}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>Try again</p>
    </div>
    <div style="text-align:center; padding: 8px 0 24px;">
      <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
      <h2 style="font-size:18px; color:#f29900; margin-bottom:12px;" data-testid="reset-error" role="alert">Passwords Do Not Match</h2>
      <p style="font-size:14px; color:#666; line-height:1.6;">
        The passwords you entered do not match. Please go back and try again.
      </p>
    </div>
    <a href="javascript:history.back()" style="display:block; width:100%; padding:13px; background:#1a73e8; color:#fff; border:none; border-radius:7px; font-size:15px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none; margin-top:8px;">Try Again</a>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
    return;
  }

  users[email] = newPassword;
  delete resetTokens[token];

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset – Echelix</title>
  <style>${cardPageStyles}</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/echelix-logo.png" alt="Echelix" style="height:48px; margin-bottom:12px;" />
      <p>All done!</p>
    </div>
    <div style="text-align:center; padding: 8px 0 24px;" data-testid="reset-success">
      <div style="font-size:48px; margin-bottom:16px;">✅</div>
      <h2 style="font-size:18px; color:#34a853; margin-bottom:12px;">Password Reset Successfully</h2>
      <p style="font-size:14px; color:#666; line-height:1.6;">
        Your password has been updated. You can now sign in with your new password.
      </p>
    </div>
    <a href="/login" style="display:block; width:100%; padding:13px; background:#1a73e8; color:#fff; border:none; border-radius:7px; font-size:15px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none; margin-top:8px;">Sign In Now</a>
    <div class="footer">© ${new Date().getFullYear()} Echelix. All rights reserved.</div>
  </div>
</body>
</html>`);
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
      from: `"Echelix Support" <${process.env['GMAIL_SMTP_USER']}>`,
      to: email,
      subject: 'Reset Your Password – Echelix',
      html: buildResetEmailHtml(resetUrl),
      text: `Reset your Echelix password by visiting this link:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
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

// ─── Email template ───────────────────────────────────────────────────────────

/**
 * Builds a polished, Gmail-friendly HTML reset email.
 * Uses a dark gradient banner header so the email looks great both in the
 * inbox preview and when opened.
 */
function buildResetEmailHtml(resetUrl: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password – Echelix</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">

  <!--[if !mso]><!-->
  <!-- Gmail preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Action required: reset your Echelix account password. This link expires in 1 hour.&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;
  </div>
  <!--<![endif]-->

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Email card: max-width 600px -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

          <!-- ── BANNER HEADER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d47a1 0%,#1a73e8 60%,#42a5f5 100%);
                        padding:48px 40px 36px;text-align:center;">

              <!-- Lock icon (SVG inline — renders everywhere) -->
              <div style="display:inline-block;background:rgba(255,255,255,0.18);
                           border-radius:50%;width:72px;height:72px;line-height:72px;
                           text-align:center;margin-bottom:18px;font-size:36px;">
                &#128274;
              </div>

              <!-- Brand name -->
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:28px;font-weight:800;
                          letter-spacing:1.5px;text-transform:uppercase;
                          text-shadow:0 1px 4px rgba(0,0,0,0.25);">
                ECHELIX
              </h1>
              <p style="margin:0;color:rgba(255,255,255,0.80);font-size:14px;letter-spacing:0.4px;">
                Password Reset Request
              </p>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="padding:40px 48px 32px;">

              <h2 style="margin:0 0 14px;color:#1a1a1a;font-size:22px;font-weight:700;">
                Reset Your Password
              </h2>

              <p style="margin:0 0 10px;color:#444;font-size:15px;line-height:1.7;">
                Hi there,
              </p>
              <p style="margin:0 0 28px;color:#444;font-size:15px;line-height:1.7;">
                We received a request to reset the password for your <strong>Echelix</strong>
                account. Click the button below to choose a new password.
                This link is valid for <strong>1 hour</strong>.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td align="center"
                      style="background:linear-gradient(135deg,#1558b0,#1a73e8);
                             border-radius:8px;
                             box-shadow:0 3px 10px rgba(26,115,232,0.45);">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:15px 44px;
                              color:#ffffff;font-size:16px;font-weight:700;
                              text-decoration:none;letter-spacing:0.4px;
                              border-radius:8px;">
                      Reset My Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 24px;color:#888;font-size:12px;line-height:1.6;">
                If the button doesn&#39;t work, copy and paste this link into your browser:<br/>
                <a href="${resetUrl}" style="color:#1a73e8;word-break:break-all;">${resetUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px;" />

              <!-- Security note -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background:#f8f9ff;border-left:4px solid #1a73e8;
                              border-radius:0 6px 6px 0;padding:14px 18px;">
                    <p style="margin:0;color:#555;font-size:13px;line-height:1.6;">
                      <strong style="color:#1a1a1a;">Didn&#39;t request this?</strong><br/>
                      If you didn&#39;t ask to reset your password, you can safely ignore this
                      email — your password will remain unchanged.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#f9f9f9;padding:20px 48px;text-align:center;
                        border-top:1px solid #ebebeb;">
              <p style="margin:0 0 6px;color:#bbb;font-size:11px;">
                &copy; ${year} Echelix. All rights reserved.
              </p>
              <p style="margin:0;color:#ccc;font-size:11px;">
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['MOCK_PORT'] ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`[mock] Server running at http://localhost:${PORT}`);
});
