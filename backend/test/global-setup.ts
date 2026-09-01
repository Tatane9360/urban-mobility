import { loadTestEnv } from './env';
import { acquire } from './db-lock';

export default async function globalSetup(): Promise<void> {
  // Before acquire(), which opens its own connection from these vars.
  loadTestEnv();
  await acquire();
}
