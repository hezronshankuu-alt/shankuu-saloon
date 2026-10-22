# Shankuu Salon — Website Booking Starter

A Next.js + Supabase starter for a salon website in Dodoma, Tanzania. It includes:
- Public service catalogue and booking form
- Booking API with input validation and 50% deposit calculation
- PostgreSQL schema, row-level security, and overlap protection
- Supabase Auth owner login and owner dashboard
- Owner booking status updates and manual deposit reconciliation
- Payment integration placeholder (no real money is collected yet)

## Before you start

You need:
- A computer with Node.js 20.9+ and npm
- A Supabase account/project
- A Vercel account if you want a simple deployment

## 1. Create the Supabase backend

1. Create a project at https://supabase.com/
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Project Settings → API**, copy the project URL and publishable/anon key.
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Never expose a Supabase `service_role` key in a browser or a `NEXT_PUBLIC_` variable.

## 2. Create the owner account

1. In Supabase, open **Authentication → Users** and add the salon owner's email/password. Disable public sign-up if you don't want customers creating auth accounts.
2. Copy the user's **UID**.
3. In SQL Editor run this, replacing the UUID:
   ```sql
   insert into public.salon_owners(user_id, display_name)
   values ('OWNER-UUID-HERE', 'Shankuu');
   ```
4. Only a user in `salon_owners` can access the dashboard. Open `/admin/login`.

## 3. Run locally

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase values
npm run dev
```

Open http://localhost:3000. The public homepage and booking form have fallback sample services, but live bookings require the schema and Supabase configuration.

## 4. Deploy the website

1. Push the project to a private GitHub repository (or upload it to your preferred Git provider).
2. Import the repository into https://vercel.com/.
3. Add the same environment variables in **Project → Settings → Environment Variables**.
4. Deploy and test `/`, `/book`, `/admin/login`, and `/api/health`.
5. Vercel provides a temporary `*.vercel.app` URL after deployment.

## 5. Choose a domain

Good name ideas to check (availability is NOT verified):
- `shankuusalon.com`
- `shankuusaldodoma.com`
- `shankuusalon.co.tz`
- `bookshankuu.com`

Start with the free Vercel URL while testing. Buy a custom domain only after checking availability and price at a registrar. If choosing `.co.tz`, confirm local registration requirements and current price with a Tanzanian registrar. Add the domain in Vercel Project → Settings → Domains and follow its DNS instructions. Do not assume a suggested name is available.

## 6. Payments: 50% mobile-money deposit

The booking API calculates `ceil(price / 2)` as the deposit amount and marks every new request `unpaid`. It DOES NOT charge a customer or confirm that money was received.

To enable real payment:
1. Register the salon with a supported merchant/payment provider.
2. Ask for the supported Tanzania mobile-money channels, onboarding requirements, fees, sandbox, and production API documentation.
3. Implement a server-side payment-initiation route. Keep provider secrets in server environment variables only.
4. Store provider transaction IDs and an idempotency key.
5. Implement a signed/webhook-verified callback route. Verify the provider's signature/status server-side before changing `payment_status`.
6. Only mark a deposit paid after a verified callback or a reconciliation flow from the provider.
7. Decide whether the salon confirms before payment, or holds a pending slot for a limited period. Add expiry/cleanup if pending bookings should release the slot.
8. Test duplicate callbacks, failed/cancelled payments, refunds, wrong amounts and wrong references.

The included owner dashboard can record a deposit manually for reconciliation, but that is an internal note, not proof of payment.

## API endpoints

### `POST /api/bookings`
JSON body:
```json
{
  "service_id": "UUID-FROM-services",
  "appointment_date": "2026-11-01",
  "start_time": "10:00",
  "customer_name": "Example Customer",
  "customer_phone": "+2557XXXXXXXX",
  "notes": "Optional style notes"
}
```
Returns booking reference, pending status, deposit amount and unpaid payment status. Requires the Supabase schema/RPC.

### `GET /api/health`
Returns whether required Supabase environment variables are configured.

### Owner
- `GET /admin/login`: owner login
- `GET /admin`: owner dashboard (requires auth and membership in `salon_owners`)

## Security and launch checklist

- [ ] Replace all illustrative prices and durations with actual salon prices.
- [ ] Create owner account and insert UID into `salon_owners`.
- [ ] Test RLS with a normal non-owner user and an anonymous user.
- [ ] Add rate limiting / bot protection to public booking endpoint before public launch.
- [ ] Add a privacy notice and define how long customer phone numbers/notes are retained.
- [ ] Add a process to contact customers and confirm or reject requests.
- [ ] Verify booking slot logic and pending-booking expiry policy.
- [ ] Use provider webhook signatures and idempotency for payments.
- [ ] Set up backups and test restore.
- [ ] Add a reliable email/SMS/WhatsApp notification provider if required.
- [ ] Test production build with `npm run build`.

## Important implementation notes

This is a starter, not a fully launched business system. The booking flow and dashboard code are included, but this environment cannot create your Supabase project, register a merchant account, buy a domain, or deploy the website on your behalf. Those steps require your accounts and explicit configuration. Have a developer review the code and database security before accepting real customer data or payments.
