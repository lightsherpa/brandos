// Reuse the one local CaastorOS Postgres container. Test schemas live in
// disposable databases; application tables, roles and services are preserved.
import { execFileSync } from 'node:child_process';

export function localTestDatabase(suite) {
  if (process.env.BRANDOS_LOCAL_DB_TESTS !== '1') return null;
  if (!/^[a-z_]+$/.test(suite)) throw Error('Invalid local test suite');
  const container = 'supabase_db_CaastorOS';
  const database = `brandos_ux_${suite}_${process.pid}`;
  const run = (query, db = 'postgres') => execFileSync('docker', [
    'exec', '-i', container, 'psql', '-U', 'postgres', '-d', db,
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
  ], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return {
    container, database,
    create() { run(`CREATE DATABASE ${database};`); },
    drop() { run(`DROP DATABASE IF EXISTS ${database} WITH (FORCE);`); },
  };
}
