# EquiYield

Cooperative savings and loan application scaffold (Express + Prisma + Redis + Next.js + Tailwind).

Versioning follows **major.minor.patch** (MM.mm.xx) — current release: **v1.0.0**. See CHANGELOG for updates.

## Structure

- apps/server: Express API, Prisma ORM, Redis cache
- apps/web: Next.js App Router admin + member UI

## Prerequisites

- Node.js 18+
- PostgreSQL
- Redis 6+

## Setup

1. Copy env files and configure values:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
```

2. Install dependencies and generate Prisma client:

```bash
npm install
npm run prisma:generate
```

3. Start PostgreSQL and Redis with Docker:

```bash
docker-compose up -d
```

4. Initialize database and run migrations:

```bash
cd apps/server
npx prisma migrate dev -n init
cd ../..
```

5. Start dev servers (Express and Next.js):

```bash
npm run dev

**Important security note:** The bootstrap admin user created by `apps/server/create-admin.ts` ships with a default password. Change it immediately after first login and rotate the script’s password before committing or sharing the repository.
```

## Docker Management

Stop containers:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f
```

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production setup guide.

### Nginx Proxy Manager Configuration

Configure a single proxy host with custom location for the API:

**1. Main Proxy Host:**
- **Domain:** `equiyield.sanchez.ph` (your domain)
- **Scheme:** `http`
- **Forward Hostname:** `equiyield-web`
- **Forward Port:** `3000`
- **Cache Assets:** ✓
- **Block Common Exploits:** ✓
- **Websockets Support:** ✓
- **SSL:** Request Let's Encrypt certificate, Force SSL

**2. Custom Location (same proxy host):**
- Go to **"Custom Locations"** tab
- **Location:** `/api`
- **Scheme:** `http`
- **Forward Hostname:** `equiyield-server`
- **Forward Port:** `4000`

This routes:
- `yourdomain.com/` → Frontend (Next.js web)
- `yourdomain.com/api/*` → Backend (Express API)

**Cloudflare Users:** If using Cloudflare proxy, temporarily set DNS to **DNS Only** (gray cloud) during initial SSL certificate generation, then re-enable proxy after certificate is issued.

## Admin Header

Sensitive admin APIs require `x-admin-token` header equal to `ADMIN_TOKEN` from `apps/server/.env`.

## Key API Endpoints

- Admin
	- GET /api/admin/system-config — Get system config
	- PUT /api/admin/system-config — Update system config
	- GET /api/admin/users — List members (paginated)
	- POST /api/admin/users — Create member (auto-generates password; returns plaintext)
	- POST /api/admin/users/:id/reset-password — Reset one member password
	- POST /api/admin/users/bulk-passwords — Bulk reset passwords
	- GET /api/admin/users/import/template — Download Excel template
	- POST /api/admin/users/import — Upload Excel and create members
	- GET /api/admin/users/:id — Member detail
	- PUT /api/admin/cycles/:year/:cycle/users/:id/eligibility — Set cycle dividend eligibility (requires reason when ineligible)
	- POST /api/admin/contributions — Record contribution (validates FULL vs PARTIAL)
	- GET /api/admin/loans — List loans (paginated; supports ?status=PENDING|RELEASED|PAID filter)
	- POST /api/admin/loans — Create loan (admin-created loans are RELEASED)
	- PUT /api/admin/loans/:id/status — Update loan status (PENDING → RELEASED → PAID)
	- GET /api/admin/funds-available — Aggregated funds for loan creation UI
	- GET /api/admin/dividends/estimated-per-share — Cached per-share estimate
	- PUT /api/admin/profit-pool — Upsert profit pool for current year
	- GET /api/admin/dividends/payouts — List dividend payouts (filter by year/userId)
	- POST /api/admin/dividends/payouts — Create a payout record for a member
- Auth / Member
	- POST /api/auth/login — Member login (email, password)
	- POST /api/auth/change-password — Change current user password (requires auth)
	- GET /api/member/me — Current member profile (requires auth)
	- GET /api/member/loans — Member’s loans (requires auth)
	- POST /api/member/loans — Apply for a loan (creates PENDING)

## Dividend Calculation

- Profit pool is fetched from `ProfitPool` table (current year)
- Eligible users only (`is_dividend_eligible = true`)
- Pro-rata share by `share_count`
- Cached estimated dividend per share in Redis; invalidated when profit pool changes

## Member Portal

- Login: http://localhost:3000/member/login
- Dashboard: http://localhost:3000/member/dashboard
	- Change password
	- Apply for a loan (status PENDING until admin release)

Token is stored in `localStorage` as `eq_member_token` and used for authenticated member requests.

## Loans Management

- **Admin Page**: http://localhost:3000/admin/loans
	- **Status Filters**: Toggle to view by PENDING, RELEASED, or PAID status
	- **Release Action**: PENDING loans can be released to RELEASED status
	- **Mark as PAID**: RELEASED loans can be marked as PAID
	- **Member-Applied Loans**: Created with PENDING status (requires admin release)
	- **Admin-Created Loans**: Automatically created with RELEASED status

- **Member Portal**: Apply for loans from dashboard
	- Loans appear as PENDING until admin approves them

## Dividend Payouts Management

- **Admin Page**: http://localhost:3000/admin/dividends
	- **Bulk Payout Creation**: Distribute dividends to all eligible members for a year with single reference number
	- **Payout Records**: View all distributed payouts with member details, amounts, and deposit info
	- **Per-Member Recording**: Record individual payouts in member detail view (from Members page)
	- **Audit Logging**: Each payout records who created it (admin) and when for reconciliation and compliance
	- **Reference Tracking**: Each payout requires a reference number (transaction ID, receipt, batch ID, etc.) for traceability

- **Payout Fields**:
	- **Year**: Fiscal year for the payout
	- **Per Share Amount**: Dividend amount per share (auto-calculated total per member)
	- **Channel**: GCASH or BANK deposit method
	- **Reference Number** (required): Transaction ID, receipt number, or batch reference for reconciliation
	- **Deposit Date**: When the payout was deposited
	- **Member Visibility**: Members can see their payouts on their dashboard with all details

- **Bulk Operations**:
	- `POST /api/admin/dividends/payouts/bulk` — Distribute to all eligible members with single parameters
	- Response includes created count, failed count, and individual member results
	- Automatically assigns reference and tracks creator for audit trail

- **Reporting & Audit**:
	- Payout records include **Created By** field showing which admin processed the payout
	- Year-based filtering for period-end reconciliation
	- Total amount summary for each year
	- All payouts sortable by date, member, amount, and reference for easy reconciliation with bank/GCash statements

## Bulk Import

- Download template from `/api/admin/users/import/template` (or via Admin UI → Members → Advanced Actions)
- Upload filled Excel to `/api/admin/users/import`
- Response includes created accounts and plaintext passwords (distribute securely)

## Annual Archive / Purge

Trigger via Admin UI or `POST /api/admin/archive-run` with:

```
{
	"year": 2026,
	"purgeContributionsBeforeYear": 2023,
	"purgeLoansBeforeYear": 2023,
	"archiveMembers": true,
	"note": "New term reset"
}
```

Creates an `ArchiveRun` audit record and reports counts for purged/archived items.
