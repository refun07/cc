# DSCC Community Centre Marketplace

Digital marketplace for Dhaka South City Corporation community centres.
React + Laravel + (SQLite for dev / MySQL-ready).

The app implements an end-to-end booking marketplace plus operational portals for
DSCC administrators, community-centre owners, and zero-waste collection partners.

## What's built

**Backend (`/backend`, Laravel 12)**
- Migrations for the customer-slice tables: `community_centres`, `centre_images`,
  `centre_facilities`, `availability_slots`, `food_menus`, `bookings`,
  `booking_food_items`, `payments` (+ `users` extended with role/status/phone).
- Eloquent models & relationships.
- `BookingService` with transparent price calc: venue + food + 5% service charge + 7.5% VAT.
  Full-day bookings block the whole date; half-day blocks one session.
- Public and authenticated customer APIs:
  - `GET  /api/centres` (filters: `q, area, guests, max_price, verified, sort`)
  - `GET  /api/centres/{slug}`
  - `GET  /api/centres/{slug}/availability`
  - `GET  /api/centres/{slug}/food-menus`
  - `POST /api/bookings/quote` — live price breakdown
  - `POST /api/bookings` — create booking request
  - `GET  /api/bookings/{booking_no}`
  - `POST /api/payments/initiate` — simulated local-gateway payment
- Seeder with 6 verified centres, galleries, facilities, food menus, and 45 days of availability.
- Role-protected admin, centre-owner, and zero-waste partner APIs.
- Owner operations for bookings, availability, menus, full inventory and procurement, HRM, expenses, waste, and reports.
- Inventory includes suppliers, purchase orders, partial receiving, multi-lot and expiry tracking, weighted costs, purchase returns, damaged-stock recovery/disposal, lot-aware movements, physical stock counts, variance reconciliation, and an auditable stock ledger.
- Flexible admin/owner booking creation with live availability, multiple catering menus,
  auditable discounts/surcharges, internal notes, and pay-later/advance/full/custom collection modes.
- Multi-date booking schedules with a separate session per date, combined pricing,
  availability locking, and complete slot release on cancellation.
- Centre CRM with automatic booking-contact sync, lead stages, Customer 360 booking history,
  lifetime value, follow-up scheduling, notes, tags, and interaction timelines.
- Partner pickup claiming with guarded stage transitions and verified diversion totals.
- Payment-date settlement batches with booking-level fee/tax reconciliation, duplicate prevention,
  approval/hold/paid state controls, payment references, and configurable per-centre commission rates.
- In-app notifications for booking, payroll, waste pickup, and settlement events.

**Frontend (`/frontend`, React + Vite + Tailwind + React Router + Zustand)**
- `Home` — landing page (hero, stats, features, featured centres, how-it-works, zero-waste, CTA)
- `CentreListing` — searchable/filterable grid
- `CentreDetail` — gallery, **Open Virtual Tour** (new tab), facilities, packages,
  food menus, policies + sticky booking widget with a **live price quote**
- `Checkout` — contact details, local payment methods, review summary, submit
- `BookingSuccess` — confirmation with booking number, breakdown & transaction id
- `/admin` — platform dashboard, centre moderation, bookings, users, and payments
- `/admin/settlements` — generate, approve, hold, and record auditable centre payouts
- `/owner` — centre operations, calendar, inventory, HRM, expenses, waste, and reports
- `/owner/crm` — customer pipeline, follow-ups, interaction history, and booking value
- `/owner/accounting` — P&L ledger plus settlement receivables and payout history
- `/partner` — available pickups, scheduled work, processing stages, and impact reporting
- Route-level code splitting keeps each portal out of the initial customer bundle.

## Run it

**Backend**
```bash
cd backend
php artisan migrate:fresh --seed   # first time
php artisan serve --port=8000
```

**Frontend** (proxies `/api` → `127.0.0.1:8000`)
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

### Demo logins (seeded; sign in with mobile number)
- Admin: `01700000000` / `password`
- Owner: `01710000000` … `01710000005` / `password`
- Customer: `01800000000` / `password`
- Zero Waste Partner: `01900000000` / `password`

## Using MySQL instead of SQLite
Edit `backend/.env`:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=dscc_marketplace
DB_USERNAME=root
DB_PASSWORD=yourpassword
```
Then `php artisan migrate:fresh --seed`. Migrations are written DB-agnostically.

## Not yet built (next slices from the spec)
Production payment gateway integration and production-grade token authentication such as Sanctum.
