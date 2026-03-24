import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TabsProvider } from "@/contexts/TabsContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="app-theme">
        <TabsProvider>
          <App />
        </TabsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
