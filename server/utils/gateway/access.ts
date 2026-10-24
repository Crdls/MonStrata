import { useDb } from '../db.ts'

/**
 * Validation of the client ⇄ server access lists, shared by the gateway admin
 * routes. Reachable from bare Node tests.
 */

/**
 * A JSON array of existing row ids -> the deduplicated ascending list.
 * null when the value is malformed or any id does not exist.
 */
export function parseExistingIds (value: unknown, table: 'servers' | 'gateway_clients'): number[] | null {
  if (!Array.isArray(value)) return null
  const ids = new Set<number>()
  for (const v of value) {
    if (typeof v !== 'number' || !Number.isInteger(v)) return null
    ids.add(v)
  }
  if (ids.size === 0) return []
  const marks = [...ids].map(() => '?').join(', ')
  const found = new Set((useDb()
    .prepare(`SELECT id FROM ${table} WHERE id IN (${marks})`)
    .all(...ids) as Array<{ id: number }>).map(r => r.id))
  for (const id of ids) if (!found.has(id)) return null
  return [...ids].sort((a, b) => a - b)
}
