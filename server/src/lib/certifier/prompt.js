import { readFileSync } from 'node:fs';
export const SYSTEM_PROMPT = readFileSync(new URL('./system.txt', import.meta.url), 'utf8');
export function fillSystemPrompt({ client_locale = 'en', cd_locale = 'en', mode = 'full', claim_id = '' } = {}) {
  if (!['full', 'single_claim'].includes(mode)) throw new Error('Invalid certifier mode');
  const locale = v => /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(v) ? v : 'en';
  return SYSTEM_PROMPT.replace('{{client_locale}}', locale(client_locale)).replace('{{cd_locale}}', locale(cd_locale))
    .replace('{{mode}}', mode).replace('{{claim_id}}', String(claim_id).replace(/[<>\r\n]/g, ''));
}
