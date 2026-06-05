ALTER TABLE users ADD COLUMN firstPackageActivatedAt TEXT;

UPDATE users
SET firstPackageActivatedAt = (
  SELECT MIN(rk.activatedAt)
  FROM registrationKeys rk
  WHERE rk.packageId IS NOT NULL
    AND rk.activatedAt IS NOT NULL
    AND lower(rk.email) = lower(users.email)
)
WHERE firstPackageActivatedAt IS NULL
  AND EXISTS (
    SELECT 1
    FROM registrationKeys rk
    WHERE rk.packageId IS NOT NULL
      AND rk.activatedAt IS NOT NULL
      AND lower(rk.email) = lower(users.email)
  );
