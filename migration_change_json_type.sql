-- Migration: ChangeContentJsonToTextJson
-- Date: 2026-01-18
-- Purpose: Change ContentJson column type from jsonb to json to preserve field order

-- Change the column type from jsonb to json
ALTER TABLE "PortfolioLocales" ALTER COLUMN "ContentJson" TYPE json USING "ContentJson"::json;

-- Record the migration in __EFMigrationsHistory
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260118040835_ChangeContentJsonToTextJson', '10.0.0')
ON CONFLICT DO NOTHING;
