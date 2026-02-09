START TRANSACTION;

ALTER TABLE "PortfolioAssets" DROP COLUMN "CloudFrontUrl";

ALTER TABLE "PortfolioAssets" DROP COLUMN "S3Url";

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260120190819_RemoveAssetUrlColumns', '8.0.10');

COMMIT;

