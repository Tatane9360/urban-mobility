import { config } from 'dotenv';
import { join } from 'path';

// Loaded before anything reads process.env, so the e2e run targets its own
// database instead of the one you develop against — the suites TRUNCATE shared
// tables, and pointing them at the dev database wipes the imported TaM GTFS.
//
// override:true because dotenv keeps the first value it sees: without it a
// stray DB_NAME already in the environment would win and quietly send the
// TRUNCATEs back to the dev database.
export function loadTestEnv(): void {
  config({ path: join(__dirname, '../.env.test'), override: true });
}
