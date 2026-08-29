import { acquire } from './db-lock';

export default async function globalSetup(): Promise<void> {
  await acquire();
}
