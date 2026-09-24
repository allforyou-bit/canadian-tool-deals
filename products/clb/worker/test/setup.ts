// Runs before every test file: fresh schema in the test D1 database (types: worker/test/env.d.ts).
import { applyD1Migrations, env } from 'cloudflare:test'

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
