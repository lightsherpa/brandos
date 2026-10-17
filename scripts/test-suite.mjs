// Discover every project test, including route mocks and database regressions.
// Reuse CaastorOS's existing local Postgres for disposable test databases.
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

async function collect(directory) {
  const entries = await readdir(directory, {withFileTypes:true});
  const results = await Promise.all(entries.filter(e => !['node_modules', 'vendor', '.mvp-local'].includes(e.name)).map(async entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? collect(path) : entry.name.endsWith('.test.mjs') ? [path] : [];
  }));
  return results.flat();
}
const unitOnly=process.argv.includes('--unit');
const databaseTests=new Set(['brief-output-examples-db.test.mjs','certifier-durable-db.test.mjs','reference-intake-db.test.mjs','migration-replay.test.mjs','output-status-db.test.mjs']);
const files = (await Promise.all(['src','server/src','scripts'].map(collect))).flat().filter(path=>!unitOnly||!databaseTests.has(path.split('/').at(-1))).sort();
console.log(`Running ${files.length} test files${unitOnly?' (unit and mocked routes)':' including database regressions in supabase_db_CaastorOS'}.`);
const child = spawn(process.execPath, ['--experimental-test-module-mocks','--test',...files], {
  stdio:'inherit', env:{...process.env, BRANDOS_LOCAL_DB_TESTS:'1'},
});
child.on('error', error => {console.error(error.message);process.exitCode=1;});
child.on('exit', code => {process.exitCode=code ?? 1;});
