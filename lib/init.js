import { initDb } from './db';

let initialized = false;

export async function ensureInit() {
  if (initialized) return;
  await initDb();
  initialized = true;
}
