import { ApiError, login, logout, me, ping, type PublicUser } from "./api";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(inner: string): string {
  return `<header class="w3-bar w3-theme w3-large">
      <span class="w3-bar-item">Tessera editor</span>
    </header>
    <main class="editor-main">${inner}</main>`;
}

function loginView(error = "", username = ""): string {
  return shell(`<form id="login-form" class="w3-card w3-white w3-padding-large editor-card">
      <h1 class="w3-large">Sign in</h1>
      <p class="w3-text-grey">Session cookie stays on this origin. Seed user: <code>admin</code> / <code>admin</code>.</p>
      ${error ? `<p class="w3-panel w3-pale-red w3-leftbar w3-border-red" role="alert">${escapeHtml(error)}</p>` : ""}
      <p>
        <label for="username">Username</label>
        <input id="username" name="username" class="w3-input w3-border w3-margin-top" autocomplete="username" required value="${escapeHtml(username)}" />
      </p>
      <p>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" class="w3-input w3-border w3-margin-top" autocomplete="current-password" required />
      </p>
      <p>
        <button type="submit" class="w3-button w3-theme">Sign in</button>
      </p>
    </form>`);
}

function sessionView(user: PublicUser, pingText = "", pingError = ""): string {
  const result = pingError
    ? `<p class="w3-panel w3-pale-red w3-leftbar w3-border-red" role="alert">${escapeHtml(pingError)}</p>`
    : pingText
      ? `<pre class="w3-code w3-pale-green editor-result">${escapeHtml(pingText)}</pre>`
      : "";
  return shell(`<section class="w3-card w3-white w3-padding-large editor-card">
      <h1 class="w3-large">Signed in as ${escapeHtml(user.username)}</h1>
      <p class="w3-text-grey">POST <code>api/ping</code> is the editor-gated placeholder mutation.</p>
      ${result}
      <p class="editor-actions">
        <button type="button" class="w3-button w3-theme" data-action="ping">Ping API</button>
        <button type="button" class="w3-button w3-border" data-action="logout">Sign out</button>
      </p>
    </section>`);
}

export async function mount(root: HTMLElement): Promise<void> {
  try {
    bindSession(root, await me());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      bindLogin(root);
      return;
    }
    bindLogin(root, err instanceof Error ? err.message : "Could not load session.");
  }
}

function bindLogin(root: HTMLElement, error?: string, username = ""): void {
  root.innerHTML = loginView(error, username);
  const form = root.querySelector<HTMLFormElement>("#login-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const nextUsername = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    try {
      await login(nextUsername, password);
      bindSession(root, await me());
    } catch (err) {
      bindLogin(root, err instanceof Error ? err.message : "Sign in failed.", nextUsername);
    }
  });
}

function bindSession(root: HTMLElement, user: PublicUser, pingText = "", pingError = ""): void {
  root.innerHTML = sessionView(user, pingText, pingError);
  root.querySelector("[data-action=ping]")?.addEventListener("click", async () => {
    try {
      const result = await ping();
      bindSession(root, user, JSON.stringify(result, null, 2));
    } catch (err) {
      bindSession(root, user, "", err instanceof Error ? err.message : "Ping failed.");
    }
  });
  root.querySelector("[data-action=logout]")?.addEventListener("click", async () => {
    try {
      await logout();
    } finally {
      bindLogin(root);
    }
  });
}
