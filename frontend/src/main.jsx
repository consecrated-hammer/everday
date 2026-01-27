import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "@glideapps/glide-data-grid/dist/index.css";
import "./styles.css";
import { AttachConsoleBridge, Logger } from "./lib/logger.js";
import { InitUiSettings } from "./lib/uiSettings.js";

const root = createRoot(document.getElementById("root"));
AttachConsoleBridge();
InitUiSettings();
Logger.Info("frontend boot");
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
