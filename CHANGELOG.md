# Changelog

## v1.0.0 (2026-01-10)

### 🚀 Initial Production Release

**Complete Features:**
- ✅ Admin and member authentication with JWT + bcrypt
- ✅ Member management with dividend eligibility tracking
- ✅ Contribution recording with payment method tracking
- ✅ Loan application and approval workflow
- ✅ Loan payment tracking with automatic settlement
- ✅ Co-maker management and visibility
- ✅ Bulk and individual dividend payout distribution
- ✅ Cycle-based dividend eligibility (15th and 30th due dates)
- ✅ Member transaction ledger with contributions and dividends
- ✅ System configuration for shares and loan limits
- ✅ Profit pool management with Redis caching
- ✅ Archive/purge functionality for historical data
- ✅ Expense tracking for profit calculation
- ✅ Comprehensive audit trails for all financial transactions

**Production Deployment:**
- Optimized Docker images (node:18, single-stage, 10-16 lines)
- PostgreSQL 16 + Redis 7 containerized backend
- Nginx Proxy Manager integration with Let's Encrypt SSL
- OCI Ampere ARM64 compatibility verified
- Demo data seed script for testing
- Network configuration for reverse proxy setup
- Environment variable security hardening

**Technical Improvements:**
- Fixed Prisma field naming consistency across schema
- Resolved Docker build issues on ARM64 architecture
- Corrected Next.js API routing for production
- Implemented hex password generation to avoid URL encoding issues
- Added comprehensive error handling and validation
- Optimized database queries with proper indexing

**Documentation:**
- Complete deployment guide (DEPLOYMENT.md)
- Admin user guide with business rules
- Session logs documenting all development work
- NPM and Cloudflare configuration instructions

**Demo Credentials:**
- Admin: `admin@equiyield.local` / `Admin@123456`
- Members: All use `Member@123` password
  - juan.delacruz@demo.com
  - maria.santos@demo.com
  - pedro.reyes@demo.com
  - ana.garcia@demo.com
  - carlos.lopez@demo.com

---

### Notes
- Admin loan editing is gated to loans without payments and not marked PAID
- Co-maker visibility includes payment status on both admin and member dashboards
- Dividend calculations follow pro-rata distribution based on eligible shares
- All financial transactions require reference numbers for audit compliance
