import assert from 'node:assert/strict'
import test from 'node:test'
import { listingLabel, fetchEstimate } from '../src/api.js'

test('a missing address falls back to property type', () => {
  assert.equal(listingLabel({ property_type: 'apartment' }), 'Apartment')
})

test('a null address falls back to city', () => {
  assert.equal(listingLabel({ address: null, city: 'Demo City' }), 'Demo City')
})

test('a blank address uses the generic label', () => {
  assert.equal(listingLabel({ address: '  ' }), 'Pronë')
})

test('a supplied address is trimmed', () => {
  assert.equal(listingLabel({ address: ' Demo Block A ' }), 'Demo Block A')
})

test('an unavailable estimate preserves the API explanation', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false, status: 503,
    json: async () => ({ detail: 'Estimates unavailable: no trained model is installed.' }),
  }))
  await assert.rejects(fetchEstimate('0'), /Estimates unavailable: no trained model/)
})

test('a stored estimate preserves its response', async (t) => {
  const body = { listing_id: '0', estimated_price: 100, band_pct: 8 }
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => body }))
  assert.deepEqual(await fetchEstimate('0'), body)
})
