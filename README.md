# GOOM Event Production

Responsive front-end for GOOM Event Production, an entertainment and event production company based in Niagara, Ontario.

## Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS
- Lucide icons
- Next Image

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production check

```bash
npm run build
npm run start
```

The project uses the standard Next.js build and is ready to import into Vercel.

## Current scope

The public experience is backed by Supabase when configured and keeps local fallback content while the CMS migrations are validated. Events can use legacy external ticket links/Showpass or the first-party GOOM ticketing module described below.

## Admin CMS and Supabase

The private CMS is available at `/admin`. To activate it:

1. Create a Supabase project.
2. Run `supabase/migrations/202608200001_goom_cms.sql` in the Supabase SQL Editor. It creates the tables, row-level security policies, image buckets and starter content. If the first migration was already installed before administrator validation was added, also run `supabase/migrations/202608200002_admin_authorization.sql`.
   To enable Showpass embeds and promotional videos, then run `supabase/migrations/202608200003_event_media_showpass.sql`.
   To enable the optional information banner below each event hero, also run `supabase/migrations/202608210001_event_info_banner.sql`.
   Finally, run `supabase/migrations/202608210002_home_banners_hero_media_instagram.sql` to enable responsive home banners, Instagram embeds and the image/video hero selector.
   Run `supabase/migrations/202608210003_storage_upload_hardening.sql` to align all image buckets, MIME types, the 10 MB limit and administrator Storage policies.
   Run `supabase/migrations/202608220001_event_hero_preference.sql` so existing events with videos use their first video in the hero while preserving future image/video choices made in the admin.
3. Copy `.env.example` to `.env.local` and set:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   NEXT_PUBLIC_SITE_URL=https://goomevents.ca
   ```

   `NEXT_PUBLIC_SUPABASE_URL` must be the project base URL only. Do not append `/rest/v1`, `/auth/v1` or `/storage/v1`.

   Legacy Supabase projects may use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key.

4. Create the administrator manually in Supabase Authentication > Users. There is no public registration screen.
5. Open `supabase/authorize-admin.sql`, replace `admin@example.com` with the exact account email, and run it in the SQL Editor. The final query must return one row with `active = true`.
6. Disable open sign-ups in the Supabase Authentication settings and restart the development server.

The CMS manages responsive home banners, events, services, gallery images and site-wide contact/social settings. Uploaded images are stored in Supabase Storage.

Event records can also store an official Showpass widget embed. Promotional videos—including normalized Instagram, YouTube and Vimeo links—are stored as ordered URL metadata in `event_videos`; remote video files are never copied into the database or converted to base64. This feature does not require additional environment variables.

## Vercel

Import the project as a Next.js application. In Project Settings > Environment Variables, add the public Supabase values plus the server-only ticketing values listed in `.env.example`, then redeploy. The service-role, Square, encryption and email secrets must never use a `NEXT_PUBLIC_` prefix.

After deployment, set the production domain as the Supabase Authentication Site URL. If preview deployments will be used to sign in, add the appropriate Vercel preview pattern to Supabase's allowed Redirect URLs. Password login itself does not use a callback route, but keeping the URL configuration accurate prevents future email or OAuth flows from redirecting to the wrong host.
# GOOM ticketing setup

The first-party ticketing module is added without replacing the existing CMS or public design. Apply `supabase/migrations/202608290001_ticketing_core.sql` after the earlier migrations.

## Local and Sandbox

1. Copy the ticketing keys from `.env.example` into `.env.local`. Keep `PAYMENT_PROVIDER=mock` to test successful and failed payments locally without moving money. Mock mode is rejected in production.
2. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment. It is required for webhook, public-token ticket pages, and email delivery. Never prefix it with `NEXT_PUBLIC_`.
3. Generate `PAYMENT_TOKEN_ENCRYPTION_KEY` as a random 32-byte value encoded as base64. Once Square is connected, do not rotate this key without first reconnecting Square.
4. Run the migration, then open an event in Admin → Manage tickets. Create one or more ticket types and enable direct ticket sales.

## Square Developer Dashboard

Use Square Sandbox first. Create one Square application and configure:

- OAuth redirect URL (local Sandbox): `http://localhost:3000/api/payments/square/callback`
- OAuth redirect URL (Vercel/production): `https://YOUR_DOMAIN/api/payments/square/callback`
- Webhook notification URL: `https://YOUR_DOMAIN/api/webhooks/square`
- Webhook events: `payment.created`, `payment.updated`, `refund.created`, `refund.updated`
- OAuth permissions requested by the app: `MERCHANT_PROFILE_READ`, `PAYMENTS_READ`, `PAYMENTS_WRITE`

Copy the environment-specific Application ID and Application Secret into the matching server environment. Copy the webhook subscription Signature Key into `SQUARE_WEBHOOK_SIGNATURE_KEY`. `SQUARE_WEBHOOK_URL` must exactly match the registered notification URL because it participates in HMAC signature verification.

For local webhook testing, Square needs a public HTTPS tunnel. Put that exact tunnel URL in both the Developer Dashboard and `SQUARE_WEBHOOK_URL`; localhost can be used for the Sandbox OAuth redirect, but not as a remotely delivered webhook URL.

Set `SQUARE_ENVIRONMENT=sandbox`, `PAYMENT_PROVIDER=square`, restart the app, then use Admin → Payments → Connect Square. Complete a Sandbox test purchase. The success page remains in “Confirming” until the signed webhook marks the order paid and generates its tickets.

## Production checklist

- Apply every Supabase migration and verify RLS remains enabled.
- Add all server-only variables to Vercel; expose only the existing `NEXT_PUBLIC_*` values.
- Replace Sandbox Square credentials, callback URL, webhook URL, signature key, and environment with production values.
- Keep `PAYMENT_PROVIDER=square`; mock payments cannot run when `NODE_ENV=production`.
- Configure and verify a sending domain, then set `RESEND_API_KEY` and `TICKETS_FROM_EMAIL` for ticket delivery.
- Connect the production Square seller account from Admin and run a controlled live purchase/refund/check-in test.

OAuth access and refresh tokens are encrypted with AES-256-GCM before storage. Card numbers and CVV are rendered/tokenized by Square Web Payments SDK and never pass through GOOM or Supabase.
