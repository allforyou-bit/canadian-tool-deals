import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { grantPass, revokePasses } from '../../src/billing/entitlement'
import { addDays } from '../../src/lib/time'
import { createUser, passesOf, uid } from './helpers'

const NOW = new Date('2026-10-05T12:34:56.789Z')

async function insertPass(userId: string, startsAt: Date, endsAt: Date, revoked = false): Promise<string> {
  const purchaseId = `cs_test_${uid()}`
  await env.DB.prepare(
    `INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id, revoked_at)
     VALUES (?1, ?2, 'pass30', ?3, ?4, ?5, ?6)`,
  )
    .bind(`pass_${uid()}`, userId, startsAt.toISOString(), endsAt.toISOString(), purchaseId, revoked ? NOW.toISOString() : null)
    .run()
  return purchaseId
}

describe('grantPass', () => {
  it('starts now and lasts the SKU length, in toISOString format', async () => {
    const { user } = await createUser()
    const pass = await grantPass(env, { userId: user.id, sku: 'pass30', purchaseId: `cs_${uid()}`, now: NOW })
    expect(pass.startsAt).toBe(NOW.toISOString())
    expect(pass.endsAt).toBe(addDays(NOW, 30).toISOString())
    expect(pass.sku).toBe('pass30')
  })

  it('extends from the end of the latest unrevoked pass', async () => {
    const { user } = await createUser()
    const activeEnd = addDays(NOW, 10)
    await insertPass(user.id, addDays(NOW, -20), activeEnd)
    await insertPass(user.id, addDays(NOW, -5), addDays(NOW, 50), true) // revoked: ignored
    const pass = await grantPass(env, { userId: user.id, sku: 'pass90', purchaseId: `cs_${uid()}`, now: NOW })
    expect(pass.startsAt).toBe(activeEnd.toISOString())
    expect(pass.endsAt).toBe(addDays(activeEnd, 90).toISOString())
  })

  it('ignores expired passes', async () => {
    const { user } = await createUser()
    await insertPass(user.id, addDays(NOW, -40), addDays(NOW, -10))
    const pass = await grantPass(env, { userId: user.id, sku: 'pass30', purchaseId: `cs_${uid()}`, now: NOW })
    expect(pass.startsAt).toBe(NOW.toISOString())
  })

  it('is idempotent per purchase and runs alongside statements in the same batch', async () => {
    const { user } = await createUser()
    const purchaseId = `cs_${uid()}`
    const marker = `pass_marker_${uid()}`
    const first = await grantPass(env, { userId: user.id, sku: 'pass30', purchaseId, now: NOW }, [
      env.DB.prepare("INSERT INTO webhook_events (id, type, received_at) VALUES (?1, 'test', ?2)").bind(marker, NOW.toISOString()),
    ])
    const again = await grantPass(env, { userId: user.id, sku: 'pass30', purchaseId, now: addDays(NOW, 1) })
    expect(again).toEqual(first)
    expect(await passesOf(user.id)).toHaveLength(1)
    expect(await env.DB.prepare('SELECT id FROM webhook_events WHERE id = ?1').bind(marker).first()).not.toBeNull()
  })

  it('rolls back the alongside statements when the batch fails', async () => {
    const { user } = await createUser()
    const purchaseId = `cs_${uid()}`
    const failing = env.DB.prepare('INSERT INTO no_such_table (x) VALUES (1)')
    await expect(grantPass(env, { userId: user.id, sku: 'pass30', purchaseId, now: NOW }, [failing])).rejects.toThrow()
    expect(await passesOf(user.id)).toHaveLength(0)
  })
})

describe('revokePasses', () => {
  it('returns 0 when the purchase has no active pass', async () => {
    expect(await revokePasses(env, `cs_${uid()}`, 'refunded', NOW)).toBe(0)
  })

  it('revokes and moves queued passes forward, keeping their length', async () => {
    const { user } = await createUser()
    const a = await insertPass(user.id, addDays(NOW, -10), addDays(NOW, 20))
    await insertPass(user.id, addDays(NOW, 20), addDays(NOW, 110))
    await insertPass(user.id, addDays(NOW, 110), addDays(NOW, 140))

    expect(await revokePasses(env, a, 'dispute', NOW)).toBe(1)
    const [revoked, second, third] = await passesOf(user.id)
    expect(revoked).toMatchObject({ purchase_id: a, revoke_reason: 'dispute', revoked_at: NOW.toISOString() })
    expect(second.starts_at).toBe(NOW.toISOString())
    expect(second.ends_at).toBe(addDays(NOW, 90).toISOString())
    expect(third.starts_at).toBe(addDays(NOW, 90).toISOString())
    expect(third.ends_at).toBe(addDays(NOW, 120).toISOString())
  })

  it('leaves running passes alone when a queued pass is revoked', async () => {
    const { user } = await createUser()
    await insertPass(user.id, addDays(NOW, -5), addDays(NOW, 25))
    const queued = await insertPass(user.id, addDays(NOW, 25), addDays(NOW, 55))
    await insertPass(user.id, addDays(NOW, 55), addDays(NOW, 85))
    await revokePasses(env, queued, 'refunded', NOW)
    const live = (await passesOf(user.id)).filter((p) => p.revoked_at === null)
    expect(live.map((p) => [p.starts_at, p.ends_at])).toEqual([
      [addDays(NOW, -5).toISOString(), addDays(NOW, 25).toISOString()],
      [addDays(NOW, 25).toISOString(), addDays(NOW, 55).toISOString()],
    ])
  })

  it('does not revoke twice', async () => {
    const { user } = await createUser()
    const a = await insertPass(user.id, NOW, addDays(NOW, 30))
    expect(await revokePasses(env, a, 'refunded', NOW)).toBe(1)
    expect(await revokePasses(env, a, 'dispute', NOW)).toBe(0)
    expect((await passesOf(user.id))[0].revoke_reason).toBe('refunded')
  })
})
