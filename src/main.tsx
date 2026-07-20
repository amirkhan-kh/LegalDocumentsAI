import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App";
import { I18nProvider } from "./app/i18n";
import { AuthBoundary } from "./features/auth/AuthBoundary";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthBoundary>
        <App />
      </AuthBoundary>
    </I18nProvider>
  </React.StrictMode>,
);
