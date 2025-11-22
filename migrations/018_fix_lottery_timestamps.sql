-- Migration: Fix lottery timestamps to use timezone-aware types
-- This ensures JavaScript Date objects correctly interpret the timestamps as UTC

ALTER TABLE lottery_rounds
  ALTER COLUMN started_at TYPE TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN ended_at TYPE TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN winners_selected_at TYPE TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN buyback_executed_at TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE lottery_entries
  ALTER COLUMN entry_timestamp TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE lottery_winners
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE;
