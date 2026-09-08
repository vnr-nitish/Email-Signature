import { backend } from "./backend.js";
import { isAllowedEmail, ADMIN_EMAIL } from "./app-config.js";

// Guards signatures.html. Open to ANY authenticated account now (any
// Google sign-in, or the admin's email/password login) — the GITAM domain
// check no longer decides who may use the app at all, only whether a
// default "GITAM Signature" gets auto-created (see routeAfterLogin).
//
// Only ever acts on the FIRST auth event, on purpose: Supabase silently
// re-fires this same callback whenever the tab regains focus (it's
// rechecking/refreshing the session token in the background), not just on
// actual sign-in. Reacting to every one of those re-checks was clobbering
// whatever the user had typed but not saved yet on tab-switch. A real
// logout still works fine without reacting to further events here, since
// wireLogout() redirects explicitly on its own.
export function requireSignatureAccess(onUser) {
  let handled = false;
  backend.onAuthChange((user) => {
    if (handled) return;
    handled = true;

    if (!user) {
      window.location.href = "login.html";
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

// The single "where does a freshly-authenticated user land" decision, used
// right after Google sign-in (index.html, and login.html for backends
// whose loginWithGoogle() resolves in place rather than navigating away).
// Only a verified GITAM account (or the admin) gets a default "GITAM
// Signature" auto-created; everyone else lands with zero signatures and
// creates their own via "+ New Signature".
export async function routeAfterLogin(user) {
  if (isAllowedEmail(user.email) || user.email === ADMIN_EMAIL) {
    await backend.ensureDefaultSignature(user.uid);
  }
  window.location.href = "signatures.html";
}
