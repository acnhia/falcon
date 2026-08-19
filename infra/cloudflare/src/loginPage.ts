/**
 * A standalone, server-rendered HTML page (not part of the React bundle) - the login gate in index.ts
 * blocks static-asset serving itself for an unauthenticated request, so the React app's JS is never
 * reachable pre-login. This page is what's served instead, styled to match the onboarding wizard's
 * black/green theme (react/src/index.css's `.wizard-dark` palette, duplicated here since this is a
 * separate, non-React-bundle surface).
 */
export function renderLoginPage(siteKey: string | undefined, options: { error?: string } = {}): string {
  const captchaConfigured = Boolean(siteKey)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in</title>
${captchaConfigured ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #050505;
    color: #f2f2f2;
    font: 16px/1.5 system-ui, 'Segoe UI', Roboto, sans-serif;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 380px;
    background: #111111;
    border: 1px solid #262626;
    border-radius: 12px;
    padding: 28px;
  }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .subtitle { font-size: 13px; color: #9a9a9a; margin: 0 0 20px; }
  label { display: block; font-size: 13px; color: #9a9a9a; margin: 14px 0 4px; }
  input[type="text"], input[type="password"] {
    width: 100%;
    background: #050505;
    border: 1px solid #262626;
    border-radius: 6px;
    color: #f2f2f2;
    padding: 8px 10px;
    font-size: 14px;
  }
  button {
    width: 100%;
    margin-top: 20px;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #22c55e;
    background: transparent;
    color: #22c55e;
    font-size: 14px;
    cursor: pointer;
  }
  button:hover { background: rgba(34, 197, 94, 0.16); }
  .error {
    margin-top: 14px;
    font-size: 13px;
    color: #f87171;
  }
  .turnstile-wrap { margin-top: 16px; }
</style>
</head>
<body>
  <div class="card">
    <h1>Sign in</h1>
    <p class="subtitle">Demonstration only - synthetic data. Login is required before any page or API on this site is reachable.</p>
    ${captchaConfigured ? `
    <form method="POST" action="/api/auth/login">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" autocomplete="username" required>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
      <div class="turnstile-wrap cf-turnstile" data-sitekey="${escapeHtml(siteKey ?? '')}"></div>
      <button type="submit">Sign in</button>
    </form>
    ${options.error ? `<p class="error" role="alert">${escapeHtml(options.error)}</p>` : ''}
    ` : `<p class="error" role="alert">Login is temporarily unavailable (CAPTCHA is not configured).</p>`}
  </div>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
