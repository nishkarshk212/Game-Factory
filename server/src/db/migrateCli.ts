import { runMigrations } from './schema.js';
import { seedDatabase } from './seed.js';
import { pool } from './pool.js';

async function main() {
  await runMigrations();
  await seedDatabase();
  console.log('[GameVerse] Migrations & seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

