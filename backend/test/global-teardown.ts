import { release } from './db-lock';

export default async function globalTeardown(): Promise<void> {
  await release();
}
