# Supabase setup

1. Create a Supabase project and copy its Project URL and publishable key (`sb_publishable_...`) into a local `.env` file using `.env.example` as a template. These two values are intended for browser use. Never put a secret/service-role key in any `VITE_` variable or frontend file.
2. In the Supabase SQL Editor, run migrations `202611120001_initial_schema.sql` through `202611120006_whatsapp_notifications.sql` in numeric order; run `supabase/seed.sql` after migration 001. Migration 002 installs booking holds, 003 repairs older profiles, 004 installs admin RPCs, 005 installs Razorpay state and server-only payment functions, and 006 installs WhatsApp consent, outbox, status tracking, and reminders. Admin RPCs independently verify the caller through `is_admin()`.
3. In Authentication settings, enable email/password and configure the site URL and allowed redirect URLs for local and deployed origins. Disable public signups if accounts should be invitation-only.
4. Create the requested administrator in Supabase Dashboard → Authentication → Users (email `vorexs12@gmail.com`, with a password stored only by Supabase Auth). Confirm the account in the dashboard if email confirmation is enabled. Then run `supabase/admin-bootstrap.sql` in the SQL Editor as the project owner. The script grants the database role to that email; the app verifies the role with the `is_admin()` RPC on each session. Never set an admin password in source code, `.env`, or browser storage. Use a unique, strong password for an administrator account.
5. Run `npm install`, then `npm run dev`. This starts the payment API and Vite website together. Vite chooses an available local port in the `54173`–`54199` range and prints the exact URL. Set `PORT` in `.env` to choose the API port; Vite reads the same value for its `/api` proxy. If an API is already listening on that port, the dev runner reuses it.

The app uses Supabase Auth sessions with persistent browser storage. Its admin route asks the database `is_admin()` function for the current JWT identity; RLS independently protects every admin write. Customer reservation creation requires a signed-in user. Razorpay order creation, signature verification, WhatsApp API calls, and both provider webhooks run in the Node server with server-only Supabase and provider keys. The browser receives only the Supabase publishable key and Razorpay key id. Bookings and successful payment rows are written by a service-role-only function after payment verification. Raw card data never enters ARENA X.

## Atomic booking holds

Apply the new migration `supabase/migrations/202611120002_atomic_booking_holds.sql` after the initial schema. Checkout creates a 10-minute hold using the current signed-in customer. The database serializes hold attempts by facility/date, checks bookings and blocked slots for overlap, calculates weekday/weekend and peak pricing, and returns the quote. Finalization converts the hold into a booking with a unique `AX-...` reference in one database transaction. A hold expires immediately at its `expires_at`; if `pg_cron` is already enabled, the migration schedules row cleanup every minute. Otherwise expired holds are ignored by availability and cleaned during reservation attempts.

To exercise a real simultaneous booking race, use a dedicated authenticated test customer and an unused future facility slot, then set `SUPABASE_TEST_ACCESS_TOKEN`, `SUPABASE_TEST_FACILITY_ID`, `SUPABASE_TEST_DATE`, and `SUPABASE_TEST_START_TIME` in the shell alongside the two Vite Supabase variables and run `npm run test:booking-concurrency`. It sends two independent hold RPC requests concurrently and releases the winning test hold. Do not point this at a slot you intend to sell or book.

The SQL migration defines all requested tables, relationships, timestamps, status constraints, and RLS policies. It is intended for a fresh Supabase project. Do not promote users by editing local storage or user metadata.

## Razorpay test-mode setup

Copy `.env.example` to `.env`. Keep the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser. Configure the server-only variables as follows:

- `SUPABASE_URL`: the same project URL.
- `SUPABASE_SECRET_KEY`: Supabase Dashboard → Project Settings → API Keys → secret key (`sb_secret_...`). The server also accepts the legacy `SUPABASE_SERVICE_ROLE_KEY` variable name. Store this only in local `.env` or the Node host's secret environment. Never use a `VITE_` prefix.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`: test-mode API credentials from Razorpay Dashboard → Account & Settings → API Keys. The key id is sent to checkout; the secret is used only by the server.
- `RAZORPAY_WEBHOOK_SECRET`: a separate random secret you choose when creating the webhook endpoint in Razorpay. It is not the API key secret.
- `PORT`: optional Node server port (defaults to `3001`).

Use test credentials only until the complete payment and webhook flow has been exercised. Add a Razorpay webhook at `https://YOUR_HOST/api/razorpay/webhook`, choose the same webhook secret, and subscribe to `payment.captured`, `payment.failed`, `payment.authorized`, and `order.paid`. The endpoint validates Razorpay's signature over the raw request body. Webhook event IDs are recorded transactionally so retries do not create duplicate payments. Checkout success callbacks are also verified against Razorpay's API before the database creates a booking. An expired hold does not become a booking; if a payment capture arrives after its slot expires, the attempt is flagged `refund_required` for operator follow-up.

For the requested Netlify deployment, deploy the Vite frontend to Netlify and host `server/index.mjs` on a separate Node service such as Render, Railway, Fly.io, or a managed VM. Configure the backend's `ALLOWED_ORIGINS` with the exact Netlify and custom-domain origins; set Netlify's `VITE_API_BASE_URL` to the backend HTTPS origin. Keep all backend secrets in the Node host's secret environment. The same Node server can also serve `dist` for single-host deployments. See `PRODUCTION_READINESS.md` for GitHub, domain, and release steps.

## Admin management

Apply migration `202611120004_admin_management.sql` after the other migrations. It supplies admin-only facility save, booking/payment reporting, and payment recording functions. Direct admin writes to facilities, pricing, and blocked slots also require its authenticated table grants; existing RLS policies still restrict those writes to the database-verified admin role. Venue payments entered in the dashboard are stored as succeeded payment rows, so revenue statistics count actual receipts rather than the booking's intended advance/full amount.

## WhatsApp Cloud API

Migration 006 creates a private outbox with unique per-booking keys. Verified Razorpay payment inserts queue confirmations; booking cancellations queue cancellation messages; confirmed opted-in bookings queue a reminder around 24 hours before start. The worker claims each row transactionally and treats an uncertain network send as `unknown` rather than resending. Meta status webhooks update `sent`, `delivered`, `read`, and `failed` states. The checkout opt-in is required before any message is queued.

Start in `WHATSAPP_MODE=dry-run`. This stores `simulated` delivery records and does not call Meta. For real test messages, create a Meta developer app with the official WhatsApp product, set up its test phone number and permitted recipient, and create approved utility templates. Confirmation and cancellation templates require five body variables in order: booking reference, facility, date/time, paid amount, outstanding balance. The reminder template requires the first three. Set the approved names and language in the backend environment, then set `WHATSAPP_MODE=live`.

Set the Meta callback URL to `https://api.example.com/api/whatsapp/webhook`, use `WHATSAPP_WEBHOOK_VERIFY_TOKEN` for webhook verification, and set the Meta app secret as `WHATSAPP_APP_SECRET` for request signature checks. Subscribe to message status webhooks. The official [Meta WhatsApp Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) documents the phone-number `/messages` endpoint and template request format.
