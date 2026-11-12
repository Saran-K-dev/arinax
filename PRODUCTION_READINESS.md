# ARENA X production readiness

Audit snapshot: 12 November 2026. This is a code and configuration audit of the workspace; it is not a live-provider certification or a production deployment.

## Readiness summary

The app now has a Netlify static build configuration, a separately hosted secure Node API path, persistent checkout hold idempotency, Razorpay payment verification, and an official WhatsApp Cloud API outbox. Production use still depends on applying the Supabase migrations, configuring provider webhooks/templates, and connecting a GitHub repository and hosting accounts.

| Area | Result | Notes |
|---|---|---|
| Mobile / desktop | Review complete | Main layouts use responsive Tailwind breakpoints. Visual checks should be repeated at 320, 375, 768, 1024, and 1440 px before release. |
| Routes | Source audit complete | `/`, `/sports`, `/turf/:id`, `/booking`, `/checkout`, `/booking-confirmation`, `/about`, `/contact`, `/auth`, `/admin`, `/admin/bookings`, `/admin/slots`, `/admin/pricing`, `/admin/facilities`, `/admin/payments`, and fallback. Netlify SPA rewrite is included. |
| Authentication | Code review complete | Supabase Auth persists sessions; protected API verifies bearer JWTs through Supabase Auth. |
| Authorization | Code review complete | Admin role comes from `is_admin()` and server-side database checks. Customer/admin writes remain RLS constrained. |
| Database security | Review complete | Payment attempts, webhook events, and WhatsApp outbox have no browser grants; server functions use the secret key. Apply migrations 001–006 to the target project. |
| Booking conflicts | Code review complete | Database advisory locks and overlap checks serialize holds/bookings; checkout reuses a per-user/per-slot request token across reloads. |
| Razorpay | Code review complete; live flow pending | Server creates orders, validates checkout HMAC and fetched payment details, and validates webhook HMAC with idempotent event storage. A real test transaction still requires a signed-in test user, active future slot, and applied migrations. |
| Admin dashboard | Code review complete | Facility, pricing, slot, booking, and payment screens call protected Supabase queries/RPCs. Verify against a real admin account after migrations. |
| Form validation | Review complete | Checkout validates details and country-coded phone when WhatsApp consent is selected. Contact form now opens an email draft rather than falsely claiming a message was sent. |
| Error / loading states | Review complete | API returns diagnostic errors in development; production errors remain generic. Pages include loading/error states. |
| Environment safety | Verified in workspace | `.env` and `.env.*` are ignored; a build scan found no Supabase secret in `dist`. No `.env` is included in Netlify config. |
| Performance | Improved | Route-level lazy loading reduces the initial route payload; the current build has no oversized-chunk warning. Review deployed Core Web Vitals after connecting real data and images. |
| Accessibility | Targeted fixes | Checkout and contact inputs have explicit labels; full keyboard/screen-reader and contrast audit remains a release task. |
| GitHub | Not connected | This workspace has no Git remote. Create/connect a private GitHub repository before enabling Netlify continuous deployment. |
| External services | Not live-tested | Supabase SQL, Razorpay webhooks, Meta templates, and production domains must be configured in their dashboards before end-to-end acceptance. |

## Netlify frontend

1. Push the project to a private GitHub repository. Confirm `.env` is ignored before staging (`.gitignore` contains `.env`, `.env.*`, and excludes only `.env.example`). Never add the real `.env` to GitHub.
2. In Netlify, import the GitHub repository. `netlify.toml` sets the build command to `npm run build` and publish directory to `dist`. `public/_redirects` sends SPA routes to `index.html`.
3. Set only browser-safe build variables in Netlify: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_BASE_URL` (the secure API HTTPS origin). Redeploy after changing variables.
4. Host `server/index.mjs` on a Node service. Set the secret values in that host's secret manager, run `npm start`, enable HTTPS, and set `ALLOWED_ORIGINS` to the exact Netlify site and custom-domain origins. Do not put Supabase, Razorpay, WhatsApp, or webhook secrets in Netlify's Vite build environment.

Netlify's [Vite deployment guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/) documents the Vite build/publish setup and SPA rewrite requirement; [environment variable docs](https://docs.netlify.com/build/environment-variables/get-started/) note that changes require a new deploy.

## Production environment variable checklist

**Netlify build variables (public):**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`

**Node API host secrets / settings:**

- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `ALLOWED_ORIGINS`, `PORT`, `NODE_ENV=production`
- `WHATSAPP_MODE=dry-run` for testing or `live` after approval
- For live WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED`, `WHATSAPP_TEMPLATE_BOOKING_CANCELLED`, `WHATSAPP_TEMPLATE_BOOKING_REMINDER`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Only variables prefixed `VITE_` are compiled into the frontend. Never use that prefix for the Supabase secret, Razorpay secret, Meta access token, or webhook secrets.

## Supabase deployment

1. Apply SQL migrations `202611120001` through `202611120006` in order (or link the Supabase CLI and run `supabase db push`). Run `supabase/seed.sql` after migration 001 on an empty project.
2. Configure Auth email/password and the deployed site URL plus redirect allowlist.
3. Keep `SUPABASE_SECRET_KEY` only in the Node host. Browser variables must use only the publishable key.
4. Confirm `/api/health` reports the expected Razorpay mode, `ordersReady: true`, and webhook readiness after all secrets are configured.

## Razorpay and WhatsApp setup

- Razorpay: set test keys on the API host first. Create `https://api.example.com/api/razorpay/webhook` using `RAZORPAY_WEBHOOK_SECRET`; subscribe to `payment.captured`, `payment.failed`, `payment.authorized`, and `order.paid`. Do not switch to live keys until the captured-payment and failed-payment paths have been checked.
- WhatsApp: leave `WHATSAPP_MODE=dry-run` to test queueing without sending. Create an official Meta WhatsApp Cloud API app, a test number/recipient, and approved utility templates. Set template names, language, Graph version, phone-number ID, access token, app secret, and webhook verify token on the API host. Use callback `https://api.example.com/api/whatsapp/webhook` and subscribe to status webhooks. Switch to `live` only after test messages and status callbacks succeed.
- WhatsApp confirmation/cancellation templates use five body placeholders: booking reference, facility, date/time, paid amount, and outstanding balance. The reminder template uses reference, facility, and date/time. Customers must opt in at checkout.

## Domain configuration

1. Add the customer-facing domain in Netlify Domain management and use the DNS records Netlify provides for the apex and `www` hostnames. Wait for HTTPS certificate provisioning.
2. Add an API subdomain (for example `api.example.com`) to the Node host using its assigned CNAME/A records and enable TLS.
3. Set `VITE_API_BASE_URL=https://api.example.com` in Netlify and `ALLOWED_ORIGINS=https://YOUR_SITE.netlify.app,https://example.com,https://www.example.com` on the API host. Redeploy the frontend and restart the backend.
4. Set those customer URLs as Supabase Auth Site URL/redirect allowlist values. Point the Razorpay and Meta webhook callbacks at the API subdomain.

## Final test report

Passed locally: production TypeScript/Vite build; 7 app tests; 3 Razorpay signature tests; 3 WhatsApp template/recipient tests; server syntax check; production bundle scan for the Supabase secret. The local server starts in Razorpay test mode and reports order readiness when the Supabase secret is present.

Not completed from this workspace: the checkout page currently displays `Payment request failed (500)` and a live Razorpay test checkout cannot pass until the server can reach Supabase and migrations `001`–`006` are applied; Supabase migration execution; Meta Cloud API send/delivery callback; authenticated admin route data check; Netlify deploy; domain/TLS verification; or GitHub push. The API worker reports Supabase network fetch failures in this environment. These require dashboard access/configuration and network access. Do not treat the app as production-certified until those acceptance checks are complete.
