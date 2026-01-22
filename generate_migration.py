import json
import os

def escape_sql_string(text):
    """Escape single quotes for SQL by doubling them"""
    return text.replace("'", "''")

def json_to_sql_string(json_obj):
    """Convert JSON object to a minified, SQL-escaped string"""
    # Convert to compact JSON string (no extra whitespace)
    json_str = json.dumps(json_obj, ensure_ascii=False, separators=(',', ':'))
    # Escape single quotes for SQL
    return escape_sql_string(json_str)

def read_locale_file(file_path):
    """Read and return JSON from a locale file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

# Define the file paths
base_path = r'c:\Users\zhuya\Code\portfolio\portfolio-frontend\src\locales\persons'

locale_files = {
    'karen_en': os.path.join(base_path, 'karen-zhu-EU2O', 'en.json'),
    'karen_fr': os.path.join(base_path, 'karen-zhu-EU2O', 'fr.json'),
    'jason_en': os.path.join(base_path, 'jason-zhu-EU1O', 'en.json'),
    'jason_fr': os.path.join(base_path, 'jason-zhu-EU1O', 'fr.json'),
    'jason_zh': os.path.join(base_path, 'jason-zhu-EU1O', 'zh.json'),
}

# Read all locale files
locales = {}
for key, file_path in locale_files.items():
    locales[key] = read_locale_file(file_path)

# Generate the SQL migration script
sql_script = """-- Portfolio Locale Data Migration Script
-- This script populates the PortfolioLocales table with JSON configuration data
-- for Karen and Jason's portfolios in multiple languages

-- Ensure the database is ready
-- Run this after the EF Core migrations have created the tables

-- Step 1: Clear existing locale data (optional - remove if you want to preserve existing data)
-- DELETE FROM "PortfolioLocales";

-- Step 2: Insert Karen's Users
INSERT INTO "Users" ("Id", "Subject", "Provider", "Email", "FirstName", "LastName", "CreatedAt")
VALUES 
  (gen_random_uuid(), 'karen-subject-id', 'Cognito', 'karen.zhu@example.com', 'Karen', 'Zhu', NOW())
ON CONFLICT ("Subject", "Provider") DO NOTHING;

-- Step 3: Insert Karen's English locale
INSERT INTO "PortfolioLocales" ("Id", "PortfolioId", "Language", "ContentJson", "UpdatedAt")
VALUES (
  gen_random_uuid(),
  'EU2O',
  'en',
  '{karen_en_json}',
  NOW()
)
ON CONFLICT ("PortfolioId", "Language") DO NOTHING;

-- Step 4: Insert Karen's French locale
INSERT INTO "PortfolioLocales" ("Id", "PortfolioId", "Language", "ContentJson", "UpdatedAt")
VALUES (
  gen_random_uuid(),
  'EU2O',
  'fr',
  '{karen_fr_json}',
  NOW()
)
ON CONFLICT ("PortfolioId", "Language") DO NOTHING;

-- Step 5: Insert Jason's English locale
INSERT INTO "PortfolioLocales" ("Id", "PortfolioId", "Language", "ContentJson", "UpdatedAt")
VALUES (
  gen_random_uuid(),
  'EU1O',
  'en',
  '{jason_en_json}',
  NOW()
)
ON CONFLICT ("PortfolioId", "Language") DO NOTHING;

-- Step 6: Insert Jason's French locale
INSERT INTO "PortfolioLocales" ("Id", "PortfolioId", "Language", "ContentJson", "UpdatedAt")
VALUES (
  gen_random_uuid(),
  'EU1O',
  'fr',
  '{jason_fr_json}',
  NOW()
)
ON CONFLICT ("PortfolioId", "Language") DO NOTHING;

-- Step 7: Insert Jason's Chinese locale
INSERT INTO "PortfolioLocales" ("Id", "PortfolioId", "Language", "ContentJson", "UpdatedAt")
VALUES (
  gen_random_uuid(),
  'EU1O',
  'zh',
  '{jason_zh_json}',
  NOW()
)
ON CONFLICT ("PortfolioId", "Language") DO NOTHING;

-- Step 8: Insert Karen's portfolio assets
INSERT INTO "PortfolioAssets" ("Id", "PortfolioId", "AssetKey", "S3Url", "CloudFrontUrl", "FileType", "CreatedAt")
VALUES 
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/interest_about.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/interest_about.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/interest_about.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/interest_marketing.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/interest_marketing.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/interest_marketing.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/interest_design.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/interest_design.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/interest_design.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/interest_art.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/interest_art.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/interest_art.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/interest_photography.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/interest_photography.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/interest_photography.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/engagement_cherish.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/engagement_cherish.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/engagement_cherish.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/engagement_rcfg.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/engagement_rcfg.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/engagement_rcfg.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/engagement_simonSaves.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/engagement_simonSaves.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/engagement_simonSaves.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/Personal-Character.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/Personal-Character.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/Personal-Character.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/aboutMe_hobbies.png', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/aboutMe_hobbies.png', 'https://cdn.portfolio.com/karen-zhu-EU2O/aboutMe_hobbies.png', 'image/png', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/RCFG logo.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/RCFG logo.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/RCFG logo.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/RCFG-headers.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/RCFG-headers.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/RCFG-headers.avif', 'image/avif', NOW()),
  (gen_random_uuid(), 'EU2O', 'img/karen-zhu-EU2O/FLC-headers.avif', 'https://s3.amazonaws.com/portfolio-assets/karen-zhu-EU2O/FLC-headers.avif', 'https://cdn.portfolio.com/karen-zhu-EU2O/FLC-headers.avif', 'image/avif', NOW())
ON CONFLICT ("PortfolioId", "AssetKey") DO NOTHING;

-- Step 9: Insert Jason's portfolio assets
INSERT INTO "PortfolioAssets" ("Id", "PortfolioId", "AssetKey", "S3Url", "CloudFrontUrl", "FileType", "CreatedAt")
VALUES 
  (gen_random_uuid(), 'EU1O', 'img/jason-zhu-EU1O/Personal-Character-Jason.png', 'https://s3.amazonaws.com/portfolio-assets/jason-zhu-EU1O/Personal-Character-Jason.png', 'https://cdn.portfolio.com/jason-zhu-EU1O/Personal-Character-Jason.png', 'image/png', NOW()),
  (gen_random_uuid(), 'EU1O', 'img/jason-zhu-EU1O/aboutMe_hobbies.png', 'https://s3.amazonaws.com/portfolio-assets/jason-zhu-EU1O/aboutMe_hobbies.png', 'https://cdn.portfolio.com/jason-zhu-EU1O/aboutMe_hobbies.png', 'image/png', NOW()),
  (gen_random_uuid(), 'EU1O', 'img/jason-zhu-EU1O/engagements_adjudicare.png', 'https://s3.amazonaws.com/portfolio-assets/jason-zhu-EU1O/engagements_adjudicare.png', 'https://cdn.portfolio.com/jason-zhu-EU1O/engagements_adjudicare.png', 'image/png', NOW()),
  (gen_random_uuid(), 'EU1O', 'img/jason-zhu-EU1O/specialty_claims_solution.png', 'https://s3.amazonaws.com/portfolio-assets/jason-zhu-EU1O/specialty_claims_solution.png', 'https://cdn.portfolio.com/jason-zhu-EU1O/specialty_claims_solution.png', 'image/png', NOW()),
  (gen_random_uuid(), 'EU1O', 'img/jason-zhu-EU1O/specialty_technology_evolution.png', 'https://s3.amazonaws.com/portfolio-assets/jason-zhu-EU1O/specialty_technology_evolution.png', 'https://cdn.portfolio.com/jason-zhu-EU1O/specialty_technology_evolution.png', 'image/png', NOW())
ON CONFLICT ("PortfolioId", "AssetKey") DO NOTHING;

-- Verification queries
-- SELECT "PortfolioId", "Language", LENGTH("ContentJson"::text) as json_length FROM "PortfolioLocales";
-- SELECT COUNT(*) as total_locales FROM "PortfolioLocales";
"""

# Replace placeholders with actual JSON data
sql_script = sql_script.replace('{karen_en_json}', json_to_sql_string(locales['karen_en']))
sql_script = sql_script.replace('{karen_fr_json}', json_to_sql_string(locales['karen_fr']))
sql_script = sql_script.replace('{jason_en_json}', json_to_sql_string(locales['jason_en']))
sql_script = sql_script.replace('{jason_fr_json}', json_to_sql_string(locales['jason_fr']))
sql_script = sql_script.replace('{jason_zh_json}', json_to_sql_string(locales['jason_zh']))

# Write the generated script to file
output_file = r'c:\Users\zhuya\Code\portfolio\migrate_locale_data.sql'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(sql_script)

print(f"Migration script generated successfully: {output_file}")
print(f"\nGenerated SQL sizes:")
print(f"  Karen EN: {len(json_to_sql_string(locales['karen_en']))} characters")
print(f"  Karen FR: {len(json_to_sql_string(locales['karen_fr']))} characters")
print(f"  Jason EN: {len(json_to_sql_string(locales['jason_en']))} characters")
print(f"  Jason FR: {len(json_to_sql_string(locales['jason_fr']))} characters")
print(f"  Jason ZH: {len(json_to_sql_string(locales['jason_zh']))} characters")
