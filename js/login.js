import { backend } from "./backend.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("error");
const googleBtn = document.getElementById("google-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await backend.logIn({ email, password });
    window.location.href = "dashboard.html";
  } catch (err) {
    errorEl.textContent = err.message.replace("Firebase: ", "");
  }
});

googleBtn.addEventListener("click", async () => {
  errorEl.textContent = "";
  try {
    await backend.loginWithGoogle();
    window.location.href = "dashboard.html";
  } catch (err) {
    errorEl.textContent = err.message.replace("Firebase: ", "");
  }
});
