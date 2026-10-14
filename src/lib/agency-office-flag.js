// Vite injects this from AGENCY_OFFICE; no runtime storage override.
export const agencyOfficeEnabled = typeof __AGENCY_OFFICE__ !== 'undefined' && __AGENCY_OFFICE__ === true;
