# LuxeStay ✨

A rental platform: browse listings, book stays, pay (Stripe test mode), review completed stays, and manage listings as a host or moderator as an admin.

## Tech stack

- **Backend/UI:** Node.js ≥ 18, Express 4, EJS (server-rendered, Bootstrap)
- **Database:** MongoDB + Mongoose 7 (Atlas free tier for production, local Mongo or Docker for dev)
- **Auth:** Passport session auth + passport-local-mongoose (hashed passwords), roles `guest` / `host` / `admin`
- **Images:** Cloudinary via multer (falls back to an image URL or placeholder when keys are absent)
- **Payments:** Stripe Checkout + webhook (test mode only)
- **Email:** Nodemailer (SMTP)
- **Validation:** Joi on every form endpoint · **Security:** helmet, rate limiting on auth, mongo-sanitize, secure/sameSite cookies in production
- **Tests:** Node's built-in test runner, no database required · **CI:** GitHub Actions (install, test, syntax-check)

## Features

- Signup / login / logout (POST logout), protected routes, owner-only edit/delete, admin-only moderation
- Listings CRUD with Cloudinary images, category, amenities, max guests, price, location
- Server-side search: text/location, price range, guests, category, amenities, sorting, pagination (9 per page)
- Bookings: date picker, nights + 18% GST price preview, double-booking prevention (overlap query + service logic), status `pending → confirmed → completed`, cancellation
- Reviews only for completed bookings, one review per booking, author/admin-only delete, real average rating (no hardcoded stars)
- Guest: My Trips, Wishlist · Host: dashboard with listings, bookings, earnings (confirmed + completed totals) · Admin: users, listings, bookings moderation
- Privacy / Terms pages (footer links no longer 404)

## Setup

```bash
git clone https://github.com/Ganesh-123-maker/LuxeStay
cd LuxeStay
cp .env.example .env   # fill in MONGO_URL and SESSION_SECRET at minimum
npm install
npm run seed           # demo users + listings + one completed booking (see below)
npm start              # http://localhost:3000
```

Docker (app + Mongo):

```bash
docker compose up --build
# then, in another terminal: docker compose exec app npm run seed
```

> Docker build was **not** verified in this environment (no Docker daemon here) — see "Not verified" below.

## Environment variables

See `.env.example`. Required: `MONGO_URL`, `SESSION_SECRET` (required in production; a dev-only warning is printed in development if it is missing — never rely on that in production). Optional but needed for full features: `CLOUD_*`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, `SMTP_*`.

## Demo logins (demo-only — change after seeding)

Seeded by `npm run seed` (or `npm run seed:reset` to wipe first):

| Role | Username | Password |
| --- | --- | --- |
| Guest | `guest` | `Guest123!` |
| Host | `host` | `Host123!` |
| Admin | `admin` | `Admin123!` |

These are demo credentials, not production credentials. Rotate/change them before any public deployment.

## Routes (forms, server-rendered)

| Method | Route | Access |
| --- | --- | --- |
| GET/POST | `/listings`, `/listings/new`, `/listings/:id`, `/listings/:id/edit` | Public read; create/edit/delete logged-in, owner-only (admin may manage) |
| POST | `/listings/:id/bookings` | Logged-in |
| POST | `/bookings/:id/cancel`, `/confirm`, `/complete`, `/pay` | Guest/host/admin as appropriate |
| POST | `/listings/:id/reviews`, DELETE `/listings/:id/reviews/:reviewId` | Logged-in; review requires a completed booking |
| GET | `/trips`, `/wishlist`, `/dashboard` | Logged-in |
| POST | `/listings/:id/wishlist` | Logged-in |
| GET/POST | `/admin`, `/admin/users`, `/admin/listings`, `/admin/bookings` | Admin only |
| POST | `/webhooks/stripe` | Stripe webhook (raw body) |
| GET | `/privacy`, `/terms` | Public |

## Architecture

```
app.js                # fail-fast DB connect, helmet/rate-limit/sanitize, webhook (raw body first), routes, central error handler
routes/               # listing, review, user, booking, admin
controllers/          # listings, reviews, users (trips/wishlist/host dashboard), bookings, admin
services/             # bookingService (nights/GST/overlap — pure, tested), authorization (pure, tested),
                      # paymentService (Stripe, key-gated), emailService (SMTP, key-gated)
models/               # Listing, Review, Booking, User — indexed search/booking fields
middleware.js         # isLoggedIn, isOwner (null-safe), isAdmin, Joi validators
views/                # EJS: listings, users, dashboard, admin, pages
init/                 # seed script (MONGO_URL, --reset only wipes)
```

## What was fixed in this pass (audit → build)

- App now awaits the DB before listening and fails fast with a clear message when `MONGO_URL` is missing; the DB URL is no longer logged.
- No production session-secret fallback; `SESSION_SECRET` is required in production.
- Null guards + `return` after redirect in `showListing`, `renderEditForm`, `isOwner`, `isReviewAuthor`; `validateListing` added to POST `/listings`; file guard in `createListing`; signup `next` bug fixed; logout moved to POST.
- Removed `classroom/` dead tutorial code; fixed the README clone URL; renamed package from `majorproject` to `luxestay`; added `test`/`seed` scripts.
- Search, ratings, wishlist, tax display are now server-driven; hardcoded "⭐ 4.8" is gone.
- Added bookings, Stripe (key-gated), email (SMTP-gated), dashboards, admin, roles, wishlist persistence, and tests.

## Not verified / still needs keys (do not claim otherwise)

- **No live database flow:** no MongoDB, Atlas, Cloudinary, Stripe, or SMTP keys were available in this environment, so signup → book → pay → review was verified only at the unit/service level, not end-to-end against a live DB.
- **Stripe:** implemented with real Checkout + webhook code, but without `STRIPE_SECRET_KEY` a booking stays `pending` and the UI says so. No payment was faked.
- **Email:** without SMTP env vars, booking-confirmation email is only logged in development and reported as not sent.
- **Docker:** `Dockerfile` + `docker-compose.yml` are included but were not built here (no Docker daemon).
- **Deployment:** not pushed and not deployed. To deploy, supply an Atlas `MONGO_URL`, Cloudinary keys, Stripe test keys, SMTP settings, and a Vercel/Render account, then follow the deploy steps in the parent handoff.
- **No secrets were found in git history** in the audit (no `.env` or Atlas credential string in history diffs). The live risks fixed were the session-secret fallback and DB-URL logging — rotate `SESSION_SECRET` if it was ever shared.

## What I learned

- A server that prints "running" before its database connects will look healthy while every route hangs on driver buffering — await the connection and fail fast.
- Redirect-without-return is a crash in disguise: every early redirect in a controller/middleware needs a `return`.
- Key-gated integrations (Stripe/SMTP/Cloudinary) should degrade honestly — pending + a clear message — rather than faking success.
