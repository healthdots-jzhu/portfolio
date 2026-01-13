-- Data migration script to populate new columns for existing Users records
-- Run this AFTER applying the UpdateUserSubjectAndProvider schema migration

-- Update Issuer to match your Cognito authority
-- Update LastLoginAt to current timestamp for existing users
-- Set Provider to 'cognito' as default (will be updated to actual provider on next login if different)

UPDATE "Users"
SET 
    "Issuer" = 'https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_Q0F9YNAwE',
    "Provider" = 'cognito',
    "LastLoginAt" = CURRENT_TIMESTAMP
WHERE 
    "Issuer" = '' OR "Issuer" IS NULL;

-- Verify the update
SELECT 
    "Id",
    "Subject",
    "Issuer",
    "Provider",
    "Email",
    "LastLoginAt",
    "CreatedAt"
FROM "Users";
