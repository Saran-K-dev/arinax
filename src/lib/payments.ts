import { requireSupabase } from './supabase'

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export type PaymentMode = 'advance' | 'full'
export type RazorpayOrder = {
  keyId: string; orderId: string; attemptId: string; amount: number; currency: string;
  paymentMode: PaymentMode; total: number; balance: number; customerName: string;
  customerPhone: string; customerEmail: string; notificationWarning?: string
}

export type RazorpayCheckoutResult = {
  razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string
}

export type VerifiedBooking = {
  status: string; booking_id?: string; booking_reference?: string; created_at?: string;
  booking_status?: 'pending' | 'confirmed'; payment_status?: 'partial' | 'paid';
  total_amount?: number; advance_amount?: number; balance_amount?: number;
  payment_amount?: number; payment_mode?: PaymentMode;
  booking?: { id: string; booking_reference: string; created_at: string; status: 'pending';
    payment_status: 'partial' | 'paid'; total_amount: number; advance_amount: number; balance_amount: number };
  paymentMode?: PaymentMode; paymentAmount?: number; message?: string
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await requireSupabase().auth.getSession()
  if (!session?.access_token) throw new Error('Sign in to continue to payment.')
  const response = await fetch(`${apiBase}${url}`, {
    ...init,
    headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json', ...init.headers },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : result.error?.message
    throw new Error(message || `Payment request failed (${response.status}).`)
  }
  return result as T
}

export function createRazorpayOrder(input: {
  holdId: string; paymentMode: PaymentMode; customerName: string; customerPhone: string; whatsappOptIn: boolean
}) {
  return request<RazorpayOrder>('/api/payments/create-order', { method: 'POST', body: JSON.stringify(input) })
}

export function verifyRazorpayPayment(attemptId: string, result: RazorpayCheckoutResult) {
  return request<VerifiedBooking>('/api/payments/verify', { method: 'POST', body: JSON.stringify({ attemptId, ...result }) })
}

export function getRazorpayPaymentStatus(attemptId: string) {
  return request<VerifiedBooking>(`/api/payments/status?attemptId=${encodeURIComponent(attemptId)}`)
}

export function cancelRazorpayCheckout(attemptId: string) {
  return request<{ status: string }>('/api/payments/cancel-checkout', { method: 'POST', body: JSON.stringify({ attemptId }) })
}

export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]')
    const script = existing ?? document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your network and retry.'))
    if (!existing) document.body.appendChild(script)
  })
}
