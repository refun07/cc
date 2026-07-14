import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";

// A client that was open during a deployment can still reference an old,
// content-hashed lazy chunk. Vite emits this event when that chunk is gone.
// Reload once so the browser picks up the current index and asset manifest.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  const retryKey = "dscc:stale-chunk-reload";
  const lastRetry = Number(sessionStorage.getItem(retryKey) || 0);

  if (Date.now() - lastRetry > 10_000) {
    sessionStorage.setItem(retryKey, String(Date.now()));
    window.location.reload();
  }
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);

// Stands the shell's boot watchdog down now that React owns the page.
window.__dsccBooted?.();
