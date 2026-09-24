// Worker tests run inside workerd via @cloudflare/vitest-pool-workers 0.22 (vitest 4 plugin API:
// cloudflareTest() + readD1Migrations(); see node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.d.mts).
// Pure-logic tests for the static site (lib/, shared/) run in the same pool — they have no DOM needs.
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./worker/migrations')
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './worker/wrangler.jsonc' },
        // Workers AI is remote-only; tests never reach Cloudflare (they stub env.AI.run)
        remoteBindings: false,
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            SITE_URL: 'https://coach.test',
            APP_VERSION: 'test',
            FROM_EMAIL: 'Coach <coach@coach.test>',
            MAILING_ADDRESS: '1 Test St, Toronto ON M5V 0A1',
            OWNER_EMAIL: 'owner@coach.test',
            ANTHROPIC_API_KEY: 'sk-ant-test',
            STRIPE_SECRET_KEY: 'sk_test_dummy',
            STRIPE_WEBHOOK_SECRET: 'whsec_test',
            RESEND_API_KEY: 're_test',
            TURNSTILE_SECRET: 'turnstile-test',
            HASH_SALT: 'test-salt',
          },
        },
      }),
    ],
    test: {
      include: ['worker/test/**/*.test.ts', 'shared/**/*.test.ts', 'lib/**/*.test.ts', 'scripts/**/*.test.ts'],
      setupFiles: ['./worker/test/setup.ts'],
      // istanbul (not v8) is the provider that works inside workerd
      coverage: {
        provider: 'istanbul',
        include: ['worker/src/**/*.ts'],
        reporter: ['text-summary', 'json-summary'],
      },
    },
  }
})
