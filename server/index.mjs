import http from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { hmacSha256, verifyHmacSha256 } from './signatures.mjs'
import { buildWhatsAppTemplateMessage } from './whatsapp-templates.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFile = path.join(root, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
// Supabase's newer sb_secret_* key replaces the legacy service_role key.
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const razorpayKeyId = process.env.RAZORPAY_KEY_ID
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
const whatsappMode = process.env.WHATSAPP_MODE || 'dry-run'
const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
const whatsappGraphVersion = process.env.WHATSAPP_GRAPH_API_VERSION
const whatsappAppSecret = process.env.WHATSAPP_APP_SECRET
const whatsappWebhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
const whatsappTemplateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en'
const whatsappTemplates = {
  booking_confirmation: process.env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED,
  booking_cancelled: process.env.WHATSAPP_TEMPLATE_BOOKING_CANCELLED,
  booking_reminder: process.env.WHATSAPP_TEMPLATE_BOOKING_REMINDER,
}
const whatsappReady = whatsappMode === 'dry-run' || whatsappMode === 'off' || Boolean(
  whatsappMode === 'live' && whatsappAccessToken && whatsappPhoneNumberId && whatsappGraphVersion &&
  whatsappAppSecret && whatsappWebhookVerifyToken && Object.values(whatsappTemplates).every(Boolean),
)
const port = Number(process.env.PORT || 43127)
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:54173,http://127.0.0.1:54173')
  .split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean))
const ordersReady = Boolean(projectUrl && serviceRoleKey && razorpayKeyId && razorpayKeySecret)
const webhooksReady = Boolean(projectUrl && serviceRoleKey && razorpayWebhookSecret)
const missingServerConfig = [
  ['SUPABASE_URL (or VITE_SUPABASE_URL)', projectUrl],
  ['SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)', serviceRoleKey],
  ['RAZORPAY_KEY_ID', razorpayKeyId],
  ['RAZORPAY_KEY_SECRET', razorpayKeySecret],
  ['RAZORPAY_WEBHOOK_SECRET', razorpayWebhookSecret],
].filter(([, value]) => !value).map(([name]) => name)
const db = projectUrl && serviceRoleKey
  ? createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

function json(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  res.end(body)
}

async function readRawBody(req, limit = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('Request body too large'), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function authenticate(req) {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!bearer || !db) throw Object.assign(new Error('Sign in to continue.'), { status: 401 })
  const { data, error } = await db.auth.getUser(bearer)
  if (error || !data.user) throw Object.assign(new Error('Your session expired. Sign in again.'), { status: 401 })
  return data.user
}

async function razorpayRequest(endpoint, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
      'content-type': 'application/json',
      ...(body?.receipt ? { 'x-razorpay-idempotency-key': body.receipt } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(result?.error?.description || 'Razorpay could not process this request.'), { status: 502 })
  return result
}

async function requireDb({ razorpayApi = false, webhook = false } = {}) {
  const missing = [
    ['SUPABASE_URL (or VITE_SUPABASE_URL)', projectUrl],
    ['SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)', serviceRoleKey],
    ...(razorpayApi ? [['RAZORPAY_KEY_ID', razorpayKeyId], ['RAZORPAY_KEY_SECRET', razorpayKeySecret]] : []),
    ...(webhook ? [['RAZORPAY_WEBHOOK_SECRET', razorpayWebhookSecret]] : []),
  ].filter(([, value]) => !value).map(([name]) => name)
  if (missing.length || !db) throw Object.assign(new Error(`Payment service is not configured on the server. Missing: ${missing.join(', ') || 'Supabase server client'}.`), { status: 503 })
}

function databaseRequestError(error, context) {
  const setupCodes = new Set(['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703', '42883', '42501'])
  if (setupCodes.has(error?.code)) {
    return Object.assign(new Error(`Supabase setup error (${error.code}) while ${context}. Apply migrations 001–006 in order and confirm the server secret key is set.`), { status: 503, code: error.code })
  }
  return Object.assign(new Error(error?.message || `Supabase request failed while ${context}.`), { status: 500, code: error?.code })
}

function safeCreateOrderError(error) {
  let detail = `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}\n${error?.stack || ''}`
  for (const secret of [serviceRoleKey, razorpayKeySecret, razorpayWebhookSecret, whatsappAccessToken, whatsappAppSecret]) {
    if (secret) detail = detail.replaceAll(secret, '[REDACTED]')
  }
  return detail
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, '[REDACTED_ID]')
}

async function createOrder(req, res) {
  const requestId = randomUUID()
  let stage = 'request_received'
  const log = (event, extra = {}) => console.info(JSON.stringify({ scope: 'create_order', requestId, stage, event, ...extra }))
  log('request_received', { method: req.method, route: '/api/payments/create-order' })
  try {
    stage = 'server_configuration'
    await requireDb({ razorpayApi: true })
    log('server_configuration_ready', { supabaseClientReady: Boolean(db), razorpayKeyIdReady: Boolean(razorpayKeyId), razorpaySecretReady: Boolean(razorpayKeySecret) })

    stage = 'authentication'
    const user = await authenticate(req)
    log('authenticated')

    stage = 'request_validation'
    const body = JSON.parse((await readRawBody(req)).toString('utf8') || '{}')
    const { holdId, paymentMode, customerName, customerPhone, whatsappOptIn = false } = body
    if (!holdId || !['advance', 'full'].includes(paymentMode)) {
      return json(res, 400, { error: 'Select a valid booking and payment option.', code: 'INVALID_BOOKING_INPUT', requestId, stage })
    }
    if (typeof customerName !== 'string' || customerName.trim().length < 2 || typeof customerPhone !== 'string' || customerPhone.trim().length < 8) {
      return json(res, 400, { error: 'Enter a valid name and phone number.', code: 'INVALID_CUSTOMER_INPUT', requestId, stage })
    }
    log('request_validated', { paymentMode, whatsappOptIn: whatsappOptIn === true })

    stage = 'hold_lookup'
    log('hold_lookup_started')
    const { data: hold, error: holdError } = await db.from('booking_holds')
      .select('id,customer_id,total_amount,status,expires_at')
      .eq('id', holdId).eq('customer_id', user.id).maybeSingle()
    if (holdError) throw databaseRequestError(holdError, 'reading the booking hold')
    log('hold_lookup_completed', { found: Boolean(hold) })

    stage = 'hold_validation'
    if (!hold || hold.status !== 'active' || Date.parse(hold.expires_at) <= Date.now()) {
      log('hold_validation_rejected', { found: Boolean(hold), status: hold?.status ?? 'missing', expired: Boolean(hold && Date.parse(hold.expires_at) <= Date.now()) })
      return json(res, 409, { error: 'Your slot hold expired. Return to booking and select the slot again.', code: 'HOLD_NOT_ACTIVE', requestId, stage })
    }
    log('hold_validation_passed')

    stage = 'booking_amount_calculation'
    log('booking_amount_calculation_started', { calculation: 'claim_razorpay_attempt database function' })
    const { data: claim, error: claimError } = await db.rpc('claim_razorpay_attempt', {
      p_hold_id: hold.id, p_customer_id: user.id, p_payment_mode: paymentMode,
      p_customer_name: customerName.trim(), p_customer_phone: customerPhone.trim(), p_customer_email: user.email ?? null,
    })
    if (claimError) {
      if (['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703', '42883', '42501'].includes(claimError.code)) throw databaseRequestError(claimError, 'claiming the payment attempt')
      throw Object.assign(new Error(claimError.message), { status: 409, code: claimError.code })
    }
    log('booking_amount_calculation_completed', { amountReturned: Number.isFinite(Number(claim?.amount)) })
    if (paymentMode === 'advance') log('advance_amount_calculation_completed', { amountReturned: Number.isFinite(Number(claim?.amount)) })

    stage = 'whatsapp_consent'
    const { error: consentError } = await db.from('payment_attempts').update({
      whatsapp_opt_in: whatsappOptIn === true,
      whatsapp_opt_in_at: whatsappOptIn === true ? new Date().toISOString() : null,
    }).eq('id', claim.attempt_id).eq('customer_id', user.id)
    const consentSchemaMissing = consentError && ['PGRST204', '42703'].includes(consentError.code)
    if (consentError && !consentSchemaMissing) throw databaseRequestError(consentError, 'saving WhatsApp consent')
    const notificationWarning = consentSchemaMissing && whatsappOptIn === true
      ? 'WhatsApp updates need the latest database migration. Your payment can continue, but updates are not yet enabled.'
      : undefined
    if (claim.order_id) {
      log('existing_order_reused')
      return json(res, 200, {
        keyId: razorpayKeyId, orderId: claim.order_id, attemptId: claim.attempt_id,
        amount: Math.round(Number(claim.amount) * 100), currency: 'INR', paymentMode,
        total: Number(hold.total_amount), balance: Number(hold.total_amount) - Number(claim.amount),
        customerName: customerName.trim(), customerPhone: customerPhone.trim(), customerEmail: user.email ?? '', notificationWarning,
      })
    }
    if (!claim.is_new) return json(res, 409, { error: 'A payment order is being prepared. Please retry in a few seconds.', code: 'PAYMENT_ATTEMPT_IN_PROGRESS', requestId, stage })

    stage = 'razorpay_initialization'
    log('razorpay_initialization_ready', { keyIdReady: Boolean(razorpayKeyId), secretReady: Boolean(razorpayKeySecret) })
    const amountPaise = Math.round(Number(claim.amount) * 100)
    stage = 'razorpay_order_creation'
    log('razorpay_order_creation_started')
    let order
    try {
      order = await razorpayRequest('/orders', { method: 'POST', body: {
        amount: amountPaise, currency: 'INR', receipt: `ax_${String(claim.attempt_id).replaceAll('-', '').slice(0, 24)}`,
        notes: { arena_x_attempt_id: claim.attempt_id, arena_x_hold_id: hold.id },
      } })
      log('razorpay_order_creation_completed')
    } catch (error) {
      await db.rpc('mark_razorpay_attempt', { p_attempt_id: claim.attempt_id, p_status: 'failed', p_failure: 'Order creation failed.' }).catch(() => {})
      throw error
    }

    stage = 'attach_razorpay_order'
    const { data: attached, error: attachError } = await db.rpc('attach_razorpay_order', { p_attempt_id: claim.attempt_id, p_order_id: order.id })
    if (attachError || attached !== true) throw attachError || new Error('Could not safely link the Razorpay order to this booking.')
    log('order_attached')
    return json(res, 200, {
      keyId: razorpayKeyId, orderId: order.id, attemptId: claim.attempt_id, amount: order.amount,
      currency: order.currency, paymentMode, total: Number(hold.total_amount),
      balance: Number(hold.total_amount) - Number(claim.amount), customerName: customerName.trim(),
      customerPhone: customerPhone.trim(), customerEmail: user.email ?? '', notificationWarning,
    })
  } catch (error) {
    log('failed', { error: safeCreateOrderError(error), status: Number(error?.status) || 500, code: error?.code || null })
    if (res.headersSent) return res.destroy()
    const status = Number(error?.status) || (error instanceof TypeError && /fetch failed|network error/i.test(error.message) ? 503 : 500)
    const publicMessage = status >= 500
      ? `Payment request failed during ${stage}. Use reference ${requestId} when checking server logs.`
      : error?.message || 'Payment order could not be created.'
    return json(res, status, {
      error: { code: error?.code || (status === 503 ? 'UPSTREAM_UNAVAILABLE' : 'CREATE_ORDER_FAILED'), message: publicMessage, requestId, stage },
    })
  }
}

async function verifyCheckoutPayment(req, res) {
  await requireDb({ razorpayApi: true })
  const user = await authenticate(req)
  const body = JSON.parse((await readRawBody(req)).toString('utf8') || '{}')
  const { attemptId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body
  if (!attemptId || !orderId || !paymentId || !signature) return json(res, 400, { error: 'Razorpay payment verification fields are incomplete.' })

  const { data: attempt, error } = await db.from('payment_attempts')
    .select('id,customer_id,order_id,amount,currency,status')
    .eq('id', attemptId).eq('customer_id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!attempt || attempt.order_id !== orderId) return json(res, 400, { error: 'Payment order does not belong to this booking.' })
  if (!verifyHmacSha256(razorpayKeySecret, `${orderId}|${paymentId}`, signature)) return json(res, 400, { error: 'Razorpay signature verification failed.' })

  const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`)
  if (payment.order_id !== orderId || Number(payment.amount) !== Math.round(Number(attempt.amount) * 100) || payment.currency !== 'INR') {
    return json(res, 400, { error: 'Verified payment details do not match the order.' })
  }
  const eventType = payment.status === 'captured' ? 'payment.captured' : payment.status === 'authorized' ? 'payment.authorized' : ''
  if (!eventType) return json(res, 200, { status: payment.status || 'pending', message: 'Payment is still being processed. We are waiting for Razorpay confirmation.' })
  const { data: result, error: processError } = await db.rpc('process_razorpay_payment_event', {
    p_event_id: `checkout:${paymentId}`, p_event_type: eventType, p_attempt_id: attempt.id,
    p_order_id: orderId, p_payment_id: paymentId, p_amount_paise: Number(payment.amount),
    p_currency: payment.currency, p_payment_method: payment.method ?? null,
  })
  if (processError) throw new Error(processError.message)
  return json(res, result.status === 'refund_required' ? 409 : 200, result)
}

async function paymentStatus(req, res, url) {
  await requireDb()
  const user = await authenticate(req)
  const attemptId = url.searchParams.get('attemptId')
  if (!attemptId) return json(res, 400, { error: 'Payment attempt is required.' })
  const { data: attempt, error } = await db.from('payment_attempts')
    .select('id,customer_id,status,booking_id,payment_mode,amount,last_failure')
    .eq('id', attemptId).eq('customer_id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!attempt) return json(res, 404, { error: 'Payment attempt not found.' })
  if (attempt.booking_id) {
    const { data: booking, error: bookingError } = await db.from('bookings')
      .select('id,booking_reference,created_at,status,payment_status,total_amount,advance_amount,balance_amount')
      .eq('id', attempt.booking_id).maybeSingle()
    if (bookingError) throw new Error(bookingError.message)
    return json(res, 200, { status: 'paid', booking, paymentMode: attempt.payment_mode, paymentAmount: Number(attempt.amount) })
  }
  return json(res, 200, { status: attempt.status, message: attempt.last_failure ?? undefined })
}

async function cancelCheckout(req, res) {
  await requireDb()
  const user = await authenticate(req)
  const { attemptId } = JSON.parse((await readRawBody(req)).toString('utf8') || '{}')
  if (!attemptId) return json(res, 400, { error: 'Payment attempt is required.' })
  const { data: attempt, error } = await db.from('payment_attempts').select('id,customer_id,status').eq('id', attemptId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!attempt || attempt.customer_id !== user.id) return json(res, 404, { error: 'Payment attempt not found.' })
  if (attempt.status !== 'paid') await db.rpc('mark_razorpay_attempt', { p_attempt_id: attempt.id, p_status: 'cancelled', p_failure: 'Checkout was closed by the customer.' })
  return json(res, 200, { status: attempt.status === 'paid' ? 'paid' : 'cancelled' })
}

async function finishWhatsAppNotification(id, result) {
  const { error } = await db.rpc('finish_whatsapp_notification', {
    p_id: id, p_status: result.status, p_message_id: result.messageId ?? null,
    p_error_code: result.errorCode ?? null, p_error_message: result.errorMessage ?? null,
    p_retry_after_seconds: result.retryAfterSeconds ?? null,
  })
  if (error) throw error
}

let whatsappWorkerBusy = false
let nextWhatsAppReminderSweep = 0
let whatsappQueueRetryAt = 0
async function processWhatsAppQueue() {
  if (!db || whatsappMode === 'off' || whatsappWorkerBusy || Date.now() < whatsappQueueRetryAt) return
  whatsappWorkerBusy = true
  try {
    if (Date.now() >= nextWhatsAppReminderSweep) {
      nextWhatsAppReminderSweep = Date.now() + 10 * 60 * 1000
      const { error: reminderError } = await db.rpc('enqueue_whatsapp_booking_reminders')
      if (reminderError) {
        console.error('WhatsApp reminder scan failed:', reminderError.code || reminderError.message)
        whatsappQueueRetryAt = Date.now() + 60_000
        return
      }
    }
    for (let i = 0; i < 10; i += 1) {
      const { data: notification, error: claimError } = await db.rpc('claim_whatsapp_notification')
      if (claimError) {
        console.error('WhatsApp queue claim failed:', claimError.code || claimError.message)
        whatsappQueueRetryAt = Date.now() + 60_000
        break
      }
      whatsappQueueRetryAt = 0
      if (!notification) break
      if (whatsappMode === 'dry-run') {
        await finishWhatsAppNotification(notification.id, { status: 'simulated', errorMessage: 'Dry-run: no message sent to WhatsApp.' })
        continue
      }
      if (whatsappMode !== 'live' || !whatsappAccessToken || !whatsappPhoneNumberId || !whatsappGraphVersion) {
        await finishWhatsAppNotification(notification.id, { status: 'failed', errorCode: 'WHATSAPP_CONFIG', errorMessage: 'WhatsApp Cloud API settings are incomplete.' })
        continue
      }
      let body
      try { body = buildWhatsAppTemplateMessage(notification, { templates: whatsappTemplates, language: whatsappTemplateLanguage }) }
      catch (error) {
        await finishWhatsAppNotification(notification.id, { status: 'failed', errorCode: 'WHATSAPP_TEMPLATE', errorMessage: error.message })
        continue
      }
      let response
      try {
        response = await fetch(`https://graph.facebook.com/${encodeURIComponent(whatsappGraphVersion)}/${encodeURIComponent(whatsappPhoneNumberId)}/messages`, {
          method: 'POST', headers: { authorization: `Bearer ${whatsappAccessToken}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
        })
      } catch {
        await finishWhatsAppNotification(notification.id, { status: 'unknown', errorCode: 'NETWORK', errorMessage: 'WhatsApp request outcome is unknown; automatic resend was stopped to avoid duplicates.' })
        continue
      }
      const result = await response.json().catch(() => ({}))
      if (response.ok && result.messages?.[0]?.id) {
        await finishWhatsAppNotification(notification.id, { status: 'sent', messageId: result.messages[0].id })
      } else {
        const providerError = result.error || {}
        await finishWhatsAppNotification(notification.id, {
          status: 'failed', errorCode: String(providerError.code || response.status),
          errorMessage: providerError.message || 'Meta rejected the WhatsApp notification.',
          retryAfterSeconds: response.status === 429 ? 120 : null,
        })
      }
    }
  } catch (error) {
    console.error('WhatsApp delivery worker failed:', error?.code || error?.message || 'unknown error')
  } finally { whatsappWorkerBusy = false }
}

function verifyWhatsAppWebhookSignature(raw, signature) {
  const match = typeof signature === 'string' && signature.match(/^sha256=([a-f0-9]{64})$/i)
  return Boolean(match && whatsappAppSecret && verifyHmacSha256(whatsappAppSecret, raw, match[1]))
}

async function whatsappWebhook(req, res, url) {
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token') || ''
    const challenge = url.searchParams.get('hub.challenge') || ''
    if (mode !== 'subscribe' || !whatsappWebhookVerifyToken || token !== whatsappWebhookVerifyToken) return json(res, 403, { error: 'WhatsApp webhook verification failed.' })
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(challenge)
  }
  if (!db || !whatsappAppSecret) return json(res, 503, { error: 'WhatsApp webhook is not configured.' })
  const raw = await readRawBody(req)
  if (!verifyWhatsAppWebhookSignature(raw, req.headers['x-hub-signature-256'])) return json(res, 401, { error: 'Invalid WhatsApp webhook signature.' })
  const payload = JSON.parse(raw.toString('utf8'))
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
    for (const status of change.value?.statuses || []) {
      const details = status.errors?.[0]
      const { error } = await db.rpc('apply_whatsapp_delivery_status', {
        p_message_id: status.id, p_status: status.status,
        p_error_code: details?.code ? String(details.code) : null,
        p_error_message: details?.title || details?.message || null,
      })
      if (error) throw error
    }
  }
  return json(res, 200, { received: true })
}

async function razorpayWebhook(req, res) {
  await requireDb({ webhook: true })
  const raw = await readRawBody(req)
  const provided = req.headers['x-razorpay-signature']
  if (!verifyHmacSha256(razorpayWebhookSecret, raw, provided)) return json(res, 400, { error: 'Invalid webhook signature.' })
  const payload = JSON.parse(raw.toString('utf8'))
  const eventType = payload.event
  let payment = payload.payload?.payment?.entity
  const orderId = payment?.order_id || payload.payload?.order?.entity?.id
  if (!orderId || !['payment.captured','payment.failed','payment.authorized','order.paid'].includes(eventType)) {
    return json(res, 200, { received: true, ignored: true })
  }
  const { data: attempt, error } = await db.from('payment_attempts').select('id').eq('order_id', orderId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!attempt) return json(res, 200, { received: true, ignored: true })
  if (!payment && eventType === 'order.paid') {
    await requireDb({ razorpayApi: true, webhook: true })
    const orderPayments = await razorpayRequest(`/orders/${encodeURIComponent(orderId)}/payments`)
    payment = orderPayments.items?.find(item => item.status === 'captured')
    if (!payment) return json(res, 200, { received: true, status: 'pending' })
  }
  if (!payment) return json(res, 200, { received: true, ignored: true })
  const eventId = String(req.headers['x-razorpay-event-id'] || createHash('sha256').update(raw).digest('hex'))
  const { data, error: processError } = await db.rpc('process_razorpay_payment_event', {
    p_event_id: eventId, p_event_type: eventType === 'order.paid' ? 'payment.captured' : eventType, p_attempt_id: attempt.id,
    p_order_id: payment.order_id, p_payment_id: payment.id,
    p_amount_paise: payment.amount, p_currency: payment.currency,
    p_payment_method: payment.method ?? null,
  })
  if (processError) throw new Error(processError.message)
  return json(res, 200, { received: true, status: data.status })
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' }

const server = http.createServer(async (req, res) => {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin')
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      const origin = req.headers.origin
      if (origin) {
        if (!allowedOrigins.has(origin.replace(/\/$/, ''))) return json(res, 403, { error: 'This origin is not allowed to call the ARENA X API.' })
        res.setHeader('access-control-allow-origin', origin)
        res.setHeader('vary', 'Origin')
        res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
        res.setHeader('access-control-allow-headers', 'authorization, content-type, x-razorpay-signature, x-hub-signature-256')
        res.setHeader('access-control-max-age', '600')
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
      if (req.method === 'POST' && url.pathname === '/api/payments/create-order') return await createOrder(req, res)
      if (req.method === 'POST' && url.pathname === '/api/payments/verify') return await verifyCheckoutPayment(req, res)
      if (req.method === 'GET' && url.pathname === '/api/payments/status') return await paymentStatus(req, res, url)
      if (req.method === 'POST' && url.pathname === '/api/payments/cancel-checkout') return await cancelCheckout(req, res)
      if (req.method === 'POST' && url.pathname === '/api/razorpay/webhook') return await razorpayWebhook(req, res)
      if (url.pathname === '/api/whatsapp/webhook' && ['GET','POST'].includes(req.method)) return await whatsappWebhook(req, res, url)
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, ordersReady ? 200 : 503, {
        ok: ordersReady, ordersReady, webhooksReady, whatsappMode, whatsappReady,
        paymentMode: razorpayKeyId?.startsWith('rzp_test_') ? 'test' : 'live', missingServerConfig,
      })
      return json(res, 404, { error: 'API route not found.' })
    }

    const dist = path.join(root, 'dist')
    if (!existsSync(dist)) return json(res, 503, { error: 'Built site not found. Run npm run build first.' })
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    let file = path.resolve(dist, `.${requested}`)
    if (!file.startsWith(dist + path.sep) || !existsSync(file) || !statSync(file).isFile()) file = path.join(dist, 'index.html')
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable' })
    createReadStream(file).pipe(res)
  } catch (error) {
    if (res.headersSent) return res.destroy()
    const upstreamUnavailable = error instanceof TypeError && /fetch failed|network error/i.test(error.message)
    const status = Number(error?.status) || (upstreamUnavailable ? 503 : 500)
    if (status >= 500) console.error('Payment API error:', error?.code || '', error?.message || 'unknown error')
    const debug = process.env.NODE_ENV !== 'production'
    json(res, status, {
      error: upstreamUnavailable
        ? 'The payment server cannot reach Supabase or Razorpay. Check server network access and the configured API credentials.'
        : status >= 500 && !debug ? 'Payment service could not complete this request. Please retry or contact support.' : error.message,
      ...(debug && error?.code ? { code: error.code } : {}),
    })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`ARENA X server listening on port ${port}; Razorpay ${razorpayKeyId?.startsWith('rzp_test_') ? 'test' : 'live'} mode; ordersReady=${ordersReady}; webhooksReady=${webhooksReady}${missingServerConfig.length ? `; missing=${missingServerConfig.join(', ')}` : ''}`)
  if (whatsappMode !== 'off') {
    console.log(`WhatsApp notifications mode=${whatsappMode}; dry-run does not transmit messages.`)
    void processWhatsAppQueue()
    setInterval(() => void processWhatsAppQueue(), 15000).unref()
  }
})
