import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  new URL('../database/migrations/073_manual_key_activation_policy.sql', import.meta.url),
  'utf8',
);

describe('manual key activation policy migration', () => {
  it('adds explicit immutable authorization fields without rewriting legacy manual keys', () => {
    expect(migrationSql).toContain('ADD COLUMN issuancePurpose');
    expect(migrationSql).toContain('ADD COLUMN activationPolicy');
    expect(migrationSql).toContain('ADD COLUMN authorizationReason');
    expect(migrationSql).toContain("WHERE orderId IS NOT NULL OR issuanceType = 'order'");
    expect(migrationSql).toContain('registration_keys_authorization_immutable');
    expect(migrationSql).not.toMatch(/DELETE\s+FROM\s+registrationKeys/i);
  });

});
