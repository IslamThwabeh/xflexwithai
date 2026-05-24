-- Add third target level support for recommendations channel trade levels
ALTER TABLE recommendationMessages ADD COLUMN takeProfit3 TEXT;
