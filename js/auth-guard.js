import { backend } from "./backend.js";

// Redirects to login.html if nobody is signed in. Otherwise calls
// onUser(user) once the auth state is known.
export function requireAuth(onUser) {
  backend.onAuthChange((user) => {
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

export async function getOrCreateProfile(uid, email) {
  const data = await backend.getProfile(uid, email);
  return { uid, data };
}
