# Database Migrations

This directory contains SQL migration files for the Blink402 database schema.

## Migration Naming Convention

**For Future Migrations**, please use the timestamp format:

```
YYYYMMDD_HHMMSS_description.sql
```

Example: `20241123_143000_add_user_preferences.sql`

This prevents numbering conflicts and maintains chronological order.

## Existing Migrations

The migrations in this directory use sequential numbering (001_, 002_, etc.). Some numbers have duplicates due to parallel development. These migrations have already been applied to production and should NOT be renamed to avoid breaking migration tracking.

### Duplicate Numbers
- **001_***: 6 files (add_creator_profiles, add_metadata_to_runs, add_payment_token, add_sol_payment_support, catalog_features, gallery_tables)
- **002_***: 3 files (add_signature_constraints, add_twitter_integration, populate_catalog_data)
- **003_***: 3 files (fix_payment_token_default, fix_status_constraint, populate_catalog_fixed)
- **004_***: 2 files (add-run-expiration, fix_payer_field_length, update_featured_blinks)
- **005_***: 3 files (add_metadata_to_runs, add_performance_indexes, cleanup_low_quality_blinks)
- **011_***: 4 files (add_b402_token_integration, add_blink_expiration, add_creator_payout_keys, add_input_and_response_fields)
- **019_***: 2 files (add_buyback_b402_amount, add_lottery_bonus_pool)

## Migration Categories

### Core Schema Migrations
Located in this directory (`/migrations`). These are numbered migrations that alter the database schema.

### Test Migrations
Located in `/scripts/test-migrations/`. These are test simulations and should NOT be run in production.

### Data Migrations
Located in `/scripts/database/`. These are one-time data updates, blink creation scripts, and utility migrations.

### Seed Data
Located in `/scripts/seed-data/`. Sample data for development/testing.

## Running Migrations

Migrations are automatically applied by the backend on startup if the migration tracking system is enabled.

For manual execution:
```bash
psql $DATABASE_URL -f migrations/FILENAME.sql
```

## Important Notes

1. **Never delete applied migrations** - They're tracked in the database
2. **Never modify applied migrations** - Create a new migration to fix issues
3. **Test migrations locally** before applying to production
4. **Use transactions** when possible (`BEGIN; ... COMMIT;`)
5. **Include rollback instructions** in comments when applicable

## Migration Checklist

Before creating a new migration:
- [ ] Use timestamp naming format (`YYYYMMDD_HHMMSS_description.sql`)
- [ ] Start with `BEGIN;` and end with `COMMIT;`
- [ ] Include rollback SQL in comments
- [ ] Test locally with development database
- [ ] Verify migration is idempotent (can run multiple times safely)
- [ ] Document any manual steps required
