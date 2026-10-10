// Local-only discovery test. Provider keys stay in process memory.
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const root=new URL('../',import.meta.url);
const local=parseEnv(await readFile(new URL('server/.env.mvp-local',root),'utf8'));
if(new URL(local.SUPABASE_URL).hostname!=='127.0.0.1'||new URL(local.SUPABASE_URL).port!=='57321')throw Error('Isolated local database required');
Object.assign(process.env,local);
const provider=parseEnv(await readFile('/Users/oscarmottaquintana/Documents/Claudio/CaastorOS/server/.env','utf8'));
for(const key of ['FIRECRAWL_API_KEY','OPENROUTER_API_KEY']){if(!provider[key])throw Error('Missing provider configuration: '+key);process.env[key]=provider[key];}
process.env.DISCOVERY_TEST_ROUTE='haiku-sonnet';
process.chdir(new URL('server/',root).pathname);
console.log('Local discovery route: Haiku 5.5 evidence → Sonnet 5.5 BIO; Gemini 3.8 Flash visual observations.');
await import('../server/src/index.js');
