# Massawe Enteprice

Production-oriented commerce application scaffold: Vite storefront/admin UI, Supabase Auth + PostgreSQL schema with RLS, Netlify deployment config and server-side payment adapter boundaries.

## Important truth about production readiness
This is real application source code, not a hosted/operating Shopify clone. It is **not ready to accept real payments yet**. No gateway credentials, merchant account, verified webhook contract, domain, shipping contract or production database can be created on your behalf. The payment endpoints deliberately refuse to claim success until a gateway adapter is implemented and tested.

## 1. Create the database and authentication
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/001_schema.sql`.
3. In Authentication settings, configure allowed site URL and email confirmation.
4. Create your owner account using the app's sign-up flow.
5. Promote that user to owner from the SQL editor, replacing the UUID:
   `update public.profiles set role='owner' where id='YOUR_AUTH_USER_UUID';`
6. Add a profile row for the owner if your project does not create it automatically:
   `insert into public.profiles(id,full_name,role) values('YOUR_AUTH_USER_UUID','Store Owner','owner') on conflict(id) do update set role='owner';`

For production, add a secure auth trigger to create profiles, review RLS policies with a security professional, and add staff role permissions. Do not make the service role key public.

## 2. Configure locally
- Install Node.js 20+
- `npm install`
- Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- `npm run dev`

## 3. Deploy to Netlify
- Push this folder to a private GitHub repository.
- Import it in Netlify. Build command `npm run build`; publish directory `dist`.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Netlify environment variables and redeploy.
- Add server-only environment variables listed in `.env.example` only in Netlify function environment settings. Never prefix secrets with `VITE_`.

## 4. Payments in Tanzania
The intended checkout methods are M-Pesa, Airtel Money, Tigo Pesa, Visa/Mastercard and bank transfer, with TZS and USD catalog pricing. A licensed payment gateway/aggregator merchant account is required. Ask the provider to confirm that your merchant account supports all requested channels, settlement currencies, refunds, card 3-D Secure, webhook signatures and test credentials. Configure the adapter from that provider's current merchant API documentation. The included functions are secure integration boundaries, not a completed gateway integration. Do not collect card PAN/CVV yourself; use provider-hosted checkout/tokenisation. Bank transfer must be reconciled against verified bank notifications or manual admin verification, never customer-uploaded screenshots alone.

## 5. Before public launch
- Complete gateway adapter and webhook verification/idempotency.
- Implement trusted checkout/order creation with server-side price and stock validation and atomic inventory decrement.
- Implement customer storefront checkout, account registration, password reset and order history.
- Add USD conversion policy/rates, tax rules, shipping zones, refunds, cancellation, invoices and transactional email.
- Add rate limiting, bot protection, audit logging, backups, monitoring, privacy/terms/returns policies and data retention.
- Run end-to-end sandbox tests and a small live payment test before launch.
