export const certifyUxEnabled = () => ['1','true'].includes(String(import.meta.env?.VITE_CERTIFY_UX || '').toLowerCase());
