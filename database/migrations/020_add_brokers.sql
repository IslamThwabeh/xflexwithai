-- Migration: Add brokers table for broker selection system
-- Phase B: Broker Foundation

CREATE TABLE IF NOT EXISTS brokers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nameEn TEXT NOT NULL,
  nameAr TEXT NOT NULL,
  descriptionEn TEXT,
  descriptionAr TEXT,
  logoUrl TEXT,
  affiliateUrl TEXT NOT NULL,
  supportWhatsapp TEXT,
  minDeposit INTEGER DEFAULT 0,
  minDepositCurrency TEXT DEFAULT 'USD',
  featuresEn TEXT, -- JSON array of feature strings
  featuresAr TEXT, -- JSON array of feature strings
  isActive INTEGER DEFAULT 1 NOT NULL,
  displayOrder INTEGER DEFAULT 0 NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed Equiti as the first broker
INSERT INTO brokers (nameEn, nameAr, descriptionEn, descriptionAr, affiliateUrl, supportWhatsapp, minDeposit, minDepositCurrency, featuresEn, featuresAr, isActive, displayOrder)
VALUES (
  'Equiti',
  'إكويتي',
  'Global regulated broker offering Forex, stocks, and commodities trading.',
  'وسيط تداول عالمي خاضع للرقابة، يقدم تداولًا على الفوركس والأسهم والسلع.',
  'https://portal.my-equiti.com/sc/register/?ibcode=IS11681&lang=ar',
  '+971527274258',
  250,
  'USD',
  '["Regulated","MT5 Support","Low Spreads","Jordan Support","Arabic Support"]',
  '["مرخص","يدعم MT5","سبريد منخفض","دعم الأردن","دعم عربي"]',
  1,
  1
);
