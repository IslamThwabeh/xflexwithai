-- Add per-user login security mode
-- password_or_otp: user can sign in with password or OTP
-- password_only: user can sign in with password only
-- password_plus_otp: user must enter password then OTP

ALTER TABLE users
ADD COLUMN loginSecurityMode TEXT NOT NULL DEFAULT 'password_or_otp';
