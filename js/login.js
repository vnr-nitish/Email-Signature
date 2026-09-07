import { backend } from "./backend.js";
import { routeAfterLogin } from "./auth-guard.js";

const googleBtn = document.getElementById("google-btn");
const errorEl = document.getElementById("error");

if (new URLSearchParams(window.location.search).get("denied")) {
  errorEl.textContent =
    "That account isn't allowed. Please sign in with a @gitam.in, @student.gitam.edu, or @alumni.gitam.edu account.";
}

googleBtn.addEventListener("click", async () => {
  errorEl.textContent = "";
  try {
    // Supabase's real Google sign-in is a full-page redirect: the browser
    // navigates away to Google here and back to index.html once it's done,
    // so nothing after this line ever runs for that backend. Local demo
    // mode resolves immediately in place, so it needs the explicit routing
    // call below.
    const user = await backend.loginWithGoogle();
    if (user) await routeAfterLogin(user);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
