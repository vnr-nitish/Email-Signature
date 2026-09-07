import { backend } from "./backend.js";
import { isAllowedEmail, ADMIN_EMAIL } from "./app-config.js";

// Redirects to login.html if nobody is signed in, or if they're signed in
// with a disallowed email domain (immediately signed back out). Otherwise
// calls onUser(user) once the auth state is known.
export function requireAuth(onUser) {
  backend.onAuthChange(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (!isAllowedEmail(user.email)) {
      await backend.logOut();
      window.location.href = "login.html?denied=1";
      return;
    }
    onUser(user);
  });
}

// Separate from requireAuth on purpose: the admin account is a plain Gmail
// address, not a @gitam.in/etc one, so it must never be run through the
// student domain check. Only admin.html uses this.
export function requireAdmin(onUser) {
  backend.onAuthChange(async (user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
      await backend.logOut();
      window.location.href = "admin-login.html";
      return;
    }
    onUser(user);
  });
}

export function wireLogout(buttonEl) {
  buttonEl.addEventListener("click", async () => {
    await backend.logOut();
    window.location.href = "login.html";
  });
}

export async function getOrCreateProfile(uid, email) {
  const data = await backend.getProfile(uid, email);
  return { uid, data };
}

// The single "where does a freshly-authenticated user land" decision, used
// right after sign-in (index.html, and login.html for backends whose
// loginWithGoogle() resolves in place rather than navigating away). New
// users with nothing saved yet go fill in their profile first; everyone
// else goes straight to their dashboard.
export async function routeAfterLogin(user) {
  if (!isAllowedEmail(user.email)) {
    await backend.logOut();
    window.location.href = "login.html?denied=1";
    return;
  }
  const profile = await backend.getProfile(user.uid, user.email);
  window.location.href = profile.detailsSubmitted ? "dashboard.html" : "profile.html";
}
