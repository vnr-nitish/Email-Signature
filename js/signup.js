import { backend } from "./backend.js";
import { ALLOWED_EMAIL_DOMAIN } from "./app-config.js";

const form = document.getElementById("signup-form");
const errorEl = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (ALLOWED_EMAIL_DOMAIN && !email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN.toLowerCase())) {
    errorEl.textContent = `Please sign up with your ${ALLOWED_EMAIL_DOMAIN} email address.`;
    return;
  }

  try {
    await backend.signUp({ name, email, password });
    window.location.href = "profile.html";
  } catch (err) {
    errorEl.textContent = err.message.replace("Firebase: ", "");
  }
});
