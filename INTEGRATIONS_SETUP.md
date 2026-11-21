
# MASSAWE ENTERPRISE
## Marketplace and Affiliate Integration

Platform commission: 5%

## 1. System overview

MASSAWE ENTERPRISE supports:

- Marketplace sellers
- Affiliate partners
- External product links
- Product click tracking
- Sales commission tracking
- Platform commission calculations

## 2. Database

Open your Supabase project.

Go to SQL Editor.

Run the complete contents of:

002_marketplace_affiliate.sql

Confirm that the tables are created successfully.

## 3. Required tables

- marketplace_sellers
- marketplace_listings
- affiliate_partners
- affiliate_clicks
- commissions
- external_store_connections

## 4. Edge Functions

Create these Supabase Edge Functions:

supabase/functions/track-click/index.ts

supabase/functions/record-commission/index.ts

## 5. Environment variables

Configure these secrets for your Edge Functions:

SUPABASE_URL

SUPABASE_SERVICE_ROLE_KEY

COMMISSION_WEBHOOK_SECRET

Never put the service-role key or webhook secret in:
- main.jsx
- index.html
- public JavaScript
- GitHub Pages frontend code

## 6. Commission calculation

MASSAWE ENTERPRISE platform commission:

5% of qualifying completed sales.

Example:

Sale amount: TZS 100,000

MASSAWE commission: TZS 5,000

Remaining amount before other fees:
TZS 95,000

Affiliate commission, seller earnings, payment processing fees
and refunds must be accounted for separately.

## 7. External stores

A seller can register an external store and provide:

- Store name
- Store URL
- Product URL
- Product details

External store connections are not automatically authorized
just because a URL is submitted.

Each external provider needs its own approved API or
integration method.

## 8. Payment integration

Before real payouts:

1. Verify the order with the payment provider.
2. Verify the payment transaction.
3. Prevent duplicate commission records.
4. Handle refunds and cancellations.
5. Reconcile seller earnings.
6. Verify seller payout details.

## 9. Deployment

Deploy the Edge Functions using the Supabase CLI.

Test with test orders before accepting real payments.

## 10. Security

- Never expose service-role credentials.
- Never trust sale amounts sent by an ordinary browser.
- Verify payment webhooks.
- Use unique idempotency keys.
- Approve sellers and affiliates before enabling them.
- Keep financial records auditable.
