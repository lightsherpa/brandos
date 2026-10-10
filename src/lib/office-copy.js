import {t} from './i18n.js';
export const officeKey = text => 'office.'+text.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
export const officeText = (text,vars) => t(officeKey(text),vars);
