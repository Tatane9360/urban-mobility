import { config } from 'dotenv';
import { DataSource } from 'typeorm';

// The e2e suites TRUNCATE shared tables, so two runs against the same database
// fight over ACCESS EXCLUSIVE locks and stall each other until the runner
// times out. Jest's maxWorkers:1 only serialises tests *within* a run; this
// advisory lock serialises the runs themselves — a second `pnpm test:e2e`
// waits for the first instead of deadlocking with it.
//
// ponytail: one global lock for the whole suite, not per table — a run takes
// well under a minute, so queueing is cheaper than reasoning about lock
// ordering. Split it per table group (GTFS / user) if that wait ever hurts.
//
// This covers the database only. Two Jest processes started in the same
// instant can still collide on Jest's own on-disk haste-map cache (EBUSY on
// Windows), which happens before any of this runs — a second or two between
// launches avoids it.
const LOCK_KEY = 728431;

// A Postgres advisory lock belongs to the session holding it, so this
// connection stays open for the whole run — hence a module-level DataSource
// rather than one per suite.
let dataSource: DataSource | null = null;

function createDataSource(): DataSource {
  config();
  const url = process.env.DATABASE_URL;
  // Mirrors src/database/database.module.ts: a managed host hands out one URL
  // and requires SSL, local docker uses the discrete vars.
  return new DataSource(
    url
      ? { type: 'postgres', url, ssl: { rejectUnauthorized: false } }
      : {
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
  );
}

export async function acquire(): Promise<void> {
  dataSource = await createDataSource().initialize();

  // Tried without blocking first, so a wait is announced instead of looking
  // like a hung test run.
  const rows = await dataSource.query<Array<{ locked: boolean }>>(
    'SELECT pg_try_advisory_lock($1) AS locked',
    [LOCK_KEY],
  );
  if (!rows[0].locked) {
    console.warn(
      [
        '',
        '[e2e] Une autre suite e2e utilise cette base — attente de sa fin.',
        '      (Les suites TRUNCATE des tables partagées : elles ne peuvent',
        '       pas tourner en même temps.)',
        '',
      ].join('\n'),
    );
    await dataSource.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  }
}

export async function release(): Promise<void> {
  if (!dataSource) return;
  // Closing the connection would drop the lock anyway; unlocking explicitly
  // keeps the intent readable and frees it even if the pool lingers.
  await dataSource.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
  await dataSource.destroy();
  dataSource = null;
}
