import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWhatsAppTemplateMessage, normalizeWhatsAppPhone } from '../server/whatsapp-templates.mjs'

const templates = {
  booking_confirmation: 'arena_booking_confirmed',
  booking_cancelled: 'arena_booking_cancelled',
  booking_reminder: 'arena_booking_reminder',
}
const data = {
  booking_reference: 'AX-123', facility_name: 'Arena Turf', booking_date: '2026-12-20',
  start_time: '19:00', paid_amount: 500, balance_amount: 500,
}

test('builds the official Cloud API confirmation template with payment totals', () => {
  const body = buildWhatsAppTemplateMessage({ notification_type: 'booking_confirmation', recipient: '+91 98765 43210', template_variables: data }, { templates, language: 'en' })
  assert.equal(body.messaging_product, 'whatsapp')
  assert.equal(body.to, '919876543210')
  assert.equal(body.type, 'template')
  assert.equal(body.template.name, templates.booking_confirmation)
  assert.deepEqual(body.template.components[0].parameters.map(p => p.text), ['AX-123', 'Arena Turf', '2026-12-20 19:00', '₹500.00', '₹500.00'])
})

test('builds cancellation and reminder template payloads with unique configured template names', () => {
  const cancellation = buildWhatsAppTemplateMessage({ notification_type: 'booking_cancelled', recipient: '919876543210', template_variables: data }, { templates })
  const reminder = buildWhatsAppTemplateMessage({ notification_type: 'booking_reminder', recipient: '919876543210', template_variables: data }, { templates })
  assert.equal(cancellation.template.name, templates.booking_cancelled)
  assert.equal(cancellation.template.components[0].parameters.length, 5)
  assert.equal(reminder.template.name, templates.booking_reminder)
  assert.equal(reminder.template.components[0].parameters.length, 3)
})

test('rejects invalid recipients and unconfigured templates', () => {
  assert.throws(() => normalizeWhatsAppPhone('123'), /country code/)
  assert.throws(() => buildWhatsAppTemplateMessage({ notification_type: 'booking_reminder', recipient: '919876543210', template_variables: data }, { templates: {} }), /Missing approved WhatsApp template/)
})
