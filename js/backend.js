import { BACKEND } from "./app-config.js";

// Every page imports `backend` from here rather than from a specific
// adapter, so switching providers is a one-line change in app-config.js.
async function loadBackend() {
  if (BACKEND === "supabase") return (await import("./backend-supabase.js")).backend;
  return (await import("./backend-local.js")).backend;
}

export const backend = await loadBackend();
