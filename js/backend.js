import { BACKEND } from "./app-config.js";

// Every page imports `backend` from here rather than from a specific
// adapter, so switching providers is a one-line change in app-config.js.
export const backend =
  BACKEND === "firebase"
    ? (await import("./backend-firebase.js")).backend
    : (await import("./backend-local.js")).backend;
