import { backend } from "./backend.js";
import { ADMIN_EMAIL } from "./app-config.js";

const form = document.getElementById("admin-login-form");
const errorEl = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const user = await backend.adminLogin({ email, password });
    if (user.email !== ADMIN_EMAIL) throw new Error("This account is not authorized as admin.");
    window.location.href = "signatures.html";
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
