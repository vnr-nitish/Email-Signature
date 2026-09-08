import { backend } from "./backend.js";
import { isAllowedEmail, ADMIN_EMAIL } from "./app-config.js";

function isAuthorized(user) {
  return Boolean(user) && (user.email === ADMIN_EMAIL || isAllowedEmail(user.email));
}

// Guards signatures.html — the one shared page both a GITAM student
// (Google sign-in) and the admin account (email/password) land on. Anyone
// else is signed out and bounced to the login page.
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
  backend.onAuthChange(async (user) => {
    if (handled) return;
    handled = true;

    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (!isAuthorized(user)) {
      await backend.logOut();
      window.location.href = "login.html?denied=1";
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
// Ensures a default "GITAM Signature" exists before proceeding — see
// ensureDefaultSignature's own comment for why this is safe to call
// unconditionally for both a GITAM student and the admin account.
export async function routeAfterLogin(user) {
  if (!isAuthorized(user)) {
    await backend.logOut();
    window.location.href = "login.html?denied=1";
    return;
  }
  await backend.ensureDefaultSignature(user.uid);
  window.location.href = "signatures.html";
}
