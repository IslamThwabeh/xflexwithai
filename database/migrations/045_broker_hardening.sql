-- Migration 045: broker hardening
-- 1) Strip min-deposit feature chips from VT Markets (the structured minDeposit column already covers this)
-- 2) Restore Equiti minDeposit to its original 250 USD (corrupted to 10 by the legacy ILS round-trip bug in AdminBrokers)
-- 3) Enforce case-insensitive uniqueness on nameEn so the conflict check is backed by a real constraint

UPDATE brokers
SET featuresEn = '["50% first deposit bonus","20% bonus on later deposits","WhatsApp support","Card, bank, and USDT funding"]',
    featuresAr = '["بونص 50٪ على أول إيداع","بونص 20٪ على الإيداعات التالية","دعم عبر واتساب","إيداع عبر البطاقة والبنك وUSDT"]',
    updatedAt = CURRENT_TIMESTAMP
WHERE lower(nameEn) = 'vt markets';

UPDATE brokers
SET minDeposit = 250,
    minDepositCurrency = 'USD',
    updatedAt = CURRENT_TIMESTAMP
WHERE lower(nameEn) = 'equiti';

CREATE UNIQUE INDEX IF NOT EXISTS brokers_nameEn_lower_unique ON brokers (lower(nameEn));
