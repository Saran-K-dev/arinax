import { randomUUID } from 'node:crypto'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const token = process.env.SUPABASE_TEST_ACCESS_TOKEN
const facilityId = process.env.SUPABASE_TEST_FACILITY_ID
const date = process.env.SUPABASE_TEST_DATE
const startTime = process.env.SUPABASE_TEST_START_TIME

if (![url, key, token, facilityId, date, startTime].every(Boolean)) {
  console.error('Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_TEST_ACCESS_TOKEN, SUPABASE_TEST_FACILITY_ID, SUPABASE_TEST_DATE, and SUPABASE_TEST_START_TIME.')
  process.exit(2)
}

async function hold(requestToken) {
  const response = await fetch(`${url}/rest/v1/rpc/create_booking_hold`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_facility_id: facilityId,
      p_booking_date: date,
      p_start_time: startTime,
      p_duration_hours: 1,
      p_request_token: requestToken,
    }),
  })
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { ok: response.ok, status: response.status, data }
}

const [first, second] = await Promise.all([hold(randomUUID()), hold(randomUUID())])
const winners = [first, second].filter(result => result.ok)
if (winners.length !== 1) {
  for (const result of winners) {
    if (result.data?.id) {
      await fetch(`${url}/rest/v1/rpc/release_booking_hold`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_hold_id: result.data.id }),
      })
    }
  }
  console.error(`Expected exactly one winner; got ${winners.length}. Responses: ${first.status}, ${second.status}`)
  process.exit(1)
}

const loser = first.ok ? second : first
if (loser.status < 400 || loser.status >= 500) {
  console.error(`Losing request did not receive a booking conflict (HTTP ${loser.status}).`)
  process.exit(1)
}

const winningHold = winners[0].data
await fetch(`${url}/rest/v1/rpc/release_booking_hold`, {
  method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_hold_id: winningHold.id }),
})
console.log(`Concurrency check passed: one hold succeeded, the simultaneous competing hold was rejected (HTTP ${loser.status}); winner hold released.`)
