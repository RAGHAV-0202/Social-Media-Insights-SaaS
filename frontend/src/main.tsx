import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register the image-cache service worker (production only — avoids
// interfering with HMR during development).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silently ignore — caching is a progressive enhancement.
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
