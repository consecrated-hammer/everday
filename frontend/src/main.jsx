import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./styles.css";
import { AttachConsoleBridge, Logger } from "./lib/logger.js";

const root = createRoot(document.getElementById("root"));
AttachConsoleBridge();
Logger.Info("frontend boot");
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
