import React from "react";
import { createRoot } from "react-dom/client";
import { initI18n } from "./lib/i18n.js";
import { agencyOfficeEnabled } from "./lib/agency-office-flag.js";

initI18n();
const root = createRoot(document.getElementById("app"));
async function renderPreview() {
  if (!agencyOfficeEnabled) {
    root.render(<main style={{padding:32}}><h1>Agency office is disabled</h1><p>Start the local server with AGENCY_OFFICE=1 to enable this preview.</p></main>);
    return;
  }
  await import("./portal-data.js");
  const {OfficePreview} = await import("./agency-office.jsx");
  root.render(<OfficePreview/>);
}
renderPreview();
