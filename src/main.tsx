import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Spotify rejects "localhost" redirect URIs, so always run on 127.0.0.1.
if (window.location.hostname === "localhost") {
  window.location.replace(window.location.href.replace("//localhost", "//127.0.0.1"));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
