/**
 * Aplica supabase/migrations/*.sql em ordem, uma vez cada.
 * Usa DBURL do .env (senha do banco — nunca vai para o app).
 *
 *   npm run db:migrate
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function main() {
  const dbUrl = process.env.DBURL;
  if (!dbUrl) {
    console.error('DBURL não definido no .env — copie .env.example e preencha.');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows: applied } = await client.query('select name from _migrations');
  const appliedSet = new Set(applied.map((r) => r.name));

  let ranAny = false;
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    ranAny = true;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`Aplicando ${file}...`);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`  ok`);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.error(`  ERRO em ${file}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  if (!ranAny) console.log('Nada a aplicar — banco já está em dia.');
  await client.end();
}

main();
