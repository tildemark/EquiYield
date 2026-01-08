# Admin Guide: Setting Up EquiYield

## Quick Start

1. **Access the Admin Panel**: Navigate to http://localhost:3000/admin/users

2. **Configure System Settings**: 
   - Go to http://localhost:3000/admin/config
   - Set your coop's share configuration:
     - **Min Shares**: Minimum number of shares a member must have (e.g., 1)
     - **Max Shares**: Maximum number of shares allowed per member (e.g., 100)
     - **Share Value**: Cost per share in PHP (e.g., 250)
   - Set loan limits:
     - **Min Loanable Amount**: Minimum loan amount in PHP (e.g., 1000)
     - **Max Loanable Amount**: Maximum loan amount in PHP (e.g., 100000)

## Managing Members

### Add a New Member

1. Go to http://localhost:3000/admin/users
2. Fill in the "Create New Member" form:
   - **Email**: Member's email address (unique identifier)
   - **Role**: Select MEMBER or ADMIN
   - **Initial Shares**: Number of shares they're availing (must be between min_shares and max_shares)
3. Click "Create Member"

### Manage Dividend Eligibility

- Each member row shows their eligibility status as a badge:
  - **Green "Eligible"**: Member will receive dividends
  - **Red "Ineligible"**: Member is excluded from dividends
- Use the **"Exclude from Dividends"** button to penalize late/delinquent members
- This exclusion affects the current fiscal year's dividend calculation

## Recording Contributions

1. Go to http://localhost:3000/admin/contributions
2. Select the member from the dropdown
3. Enter payment details:
   - **Amount**: Payment in PHP
   - **Date Paid**: When payment was received
   - **Method**: GCASH, InstaPay, Bank Transfer, or Cash
   - **Reference Number**: Transaction reference (required for audit trail)
4. The system will auto-calculate the expected amount based on:
   ```
   Expected Amount = Member's Share Count × Share Value
   ```
5. Status will be marked as:
   - **FULL**: Amount matches expected
   - **PARTIAL**: Amount is less than expected (admin receives warning)

## API Endpoints (for integration)

All endpoints require the `x-admin-token` header.

### System Configuration
- **GET** `/api/admin/system-config` - Get current config
- **PUT** `/api/admin/system-config` - Update config

### Members
- **GET** `/api/admin/users` - List all members
- **POST** `/api/admin/users` - Create new member
- **PUT** `/api/admin/users/:id/eligibility` - Toggle dividend eligibility

### Contributions
- **POST** `/api/admin/contributions` - Record contribution

### Dividends
- **GET** `/api/admin/dividends/estimated-per-share` - Get cached estimate
- **PUT** `/api/admin/profit-pool` - Update profit pool (invalidates cache)

## Business Rules

### Contribution Validation
- **Strict Rule**: Members must pay FULL share value each cycle
- Due dates: 15th and 30th of every month
- Partial payments are flagged and require admin attention

### Dividend Calculation
- Dividends are calculated from the Profit Pool
- Only members with `is_dividend_eligible = true` **and** an on-time FULL contribution for the current cycle are included
- Cycle rule: Due dates are the 15th and 30th (or last day of the month). If a member pays after the due date (e.g., pays on the 16th for the 15th cycle), they are excluded **for that cycle only**
- Pro-rata distribution based on share count:
   ```
   Per Share = Total Profit Pool ÷ Total Eligible Shares
   Member Dividend = Per Share × Member's Share Count
   ```
- Redis caches the estimated per-share value
- Cache is invalidated when profit pool changes

### Payment Audit Trail
Every contribution requires:
- Payment method (GCASH, InstaPay, Bank Transfer, Cash)
- Reference number
- Exact date paid
- Amount paid

## Example Scenarios

### Scenario 1: New Member with 5 Shares
1. Share value is set to PHP 250
2. Create member with email and share_count = 5
3. Expected bi-monthly contribution: 5 × 250 = **PHP 1,250**
4. Record payment on 15th with method and reference
5. If they pay PHP 1,000, status = PARTIAL (warning shown)

### Scenario 2: Penalize Delinquent Member
1. Member repeatedly pays late
2. Admin clicks "Exclude from Dividends" button
3. Member's `is_dividend_eligible` is set to `false`
4. Their share of profit remains in the pool (distributed to others)
5. Admin can re-include them later

### Scenario 3: Update Share Value
1. Coop decides to increase share value to PHP 300
2. Admin goes to Config page
3. Updates share_value to 300
4. All future contributions will expect PHP 300 per share
5. Cache is automatically invalidated

## Database Management

View data directly:
```bash
docker-compose exec postgres psql -U postgres -d equiyield
```

Common queries:
```sql
-- View all users
SELECT email, share_count, is_dividend_eligible FROM "User";

-- View contributions
SELECT u.email, c.amount, c.date_paid, c.status 
FROM "Contribution" c 
JOIN "User" u ON c."userId" = u.id;

-- View system config
SELECT * FROM system_config;

-- Update profit pool
INSERT INTO "ProfitPool" (year, amount, "updatedAt")
VALUES (2026, 50000, NOW())
ON CONFLICT (year) DO UPDATE SET amount = 50000, "updatedAt" = NOW();
```

## Security Notes

- Admin token is stored in `.env` file
- All sensitive operations require `x-admin-token` header
- In production, use secure secret management
- Implement proper authentication beyond admin token

## Troubleshooting

**Can't connect to database:**
```bash
docker-compose ps  # Check if containers are running
docker-compose up -d  # Start if stopped
```

**Need to reset database:**
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d
cd apps/server
npx prisma migrate dev --name init
```

**Cache not updating:**
- Redis cache keys automatically invalidate on data changes
- Manual clear: `docker-compose restart redis`
