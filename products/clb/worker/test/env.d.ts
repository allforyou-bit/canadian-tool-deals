// Test-only type augmentation: bindings from vitest.config.mts and the main module's exports.
import type { Env as WorkerEnv } from '../src/env'

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
    }
    interface GlobalProps {
      mainModule: typeof import('../src/index')
    }
  }
}
export {}
