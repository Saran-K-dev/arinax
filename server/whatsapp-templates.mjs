export function normalizeWhatsAppPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) throw new Error('WhatsApp recipient must include its country code.')
  return digits
}

export function formatWhatsAppCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
}

export function buildWhatsAppTemplateMessage(notification, { templates, language = 'en' }) {
  const type = notification.notification_type
  const name = templates[type]
  if (!name) throw new Error(`Missing approved WhatsApp template for ${type}.`)
  const data = notification.template_variables || {}
  const variables = type === 'booking_reminder'
    ? [data.booking_reference, data.facility_name, `${data.booking_date} ${data.start_time}`]
    : [data.booking_reference, data.facility_name, `${data.booking_date} ${data.start_time}`, formatWhatsAppCurrency(data.paid_amount), formatWhatsAppCurrency(data.balance_amount)]
  return {
    messaging_product: 'whatsapp',
    to: normalizeWhatsAppPhone(notification.recipient),
    type: 'template',
    template: {
      name,
      language: { code: language },
      components: [{ type: 'body', parameters: variables.map(text => ({ type: 'text', text: String(text ?? '') })) }],
    },
  }
}
