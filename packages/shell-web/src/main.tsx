import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";

function blockBrowserSwipeNavigation() {
  const style = document.createElement("style");
  style.textContent = `
    html, body {
      overscroll-behavior: none;
      touch-action: pan-y;
    }
  `;
  document.head.appendChild(style);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

blockBrowserSwipeNavigation();

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
