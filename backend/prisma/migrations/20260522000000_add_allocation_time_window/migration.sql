-- Add startDate and endDate to Allocation for permissible time window
ALTER TABLE "Allocation" ADD COLUMN "startDate" DATE;
ALTER TABLE "Allocation" ADD COLUMN "endDate" DATE;

-- Back-fill existing rows: use a wide default window so nothing breaks
UPDATE "Allocation" SET "startDate" = '2020-01-01', "endDate" = '2099-12-31' WHERE "startDate" IS NULL;

-- Now make them NOT NULL
ALTER TABLE "Allocation" ALTER COLUMN "startDate" SET NOT NULL;
ALTER TABLE "Allocation" ALTER COLUMN "endDate" SET NOT NULL;
