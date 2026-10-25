import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Spotify rejects "localhost" redirect URIs, so always run on 127.0.0.1.
if (window.location.hostname === "localhost") {
  window.location.replace(window.location.href.replace("//localhost", "//127.0.0.1"));
}

// Opera on macOS keeps flashing its own arrow over custom cursor files, even on a blank page,
// so it gets the browser's built-in crosshair instead (styles.css, html.opera).
if (/\bOPR\//.test(navigator.userAgent)) document.documentElement.classList.add("opera");

// Dev-only switches for tracking down the cursor flicker: ?debug=nofrost turns off the frosted
// glass, ?debug=still turns off every animation and transition, and ?debug=nofrost,still both.
if (import.meta.env.DEV) {
  for (const flag of new URLSearchParams(window.location.search).get("debug")?.split(",") ?? []) {
    document.documentElement.classList.add(`debug-${flag}`);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
