import React from "react";
import { createRoot } from "react-dom/client";
import { initI18n } from "./lib/i18n.js";
import "./portal-data.js";
import { OfficePreview } from "./agency-office.jsx";

initI18n();
createRoot(document.getElementById("app")).render(<OfficePreview />);
