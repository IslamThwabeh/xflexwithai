import {
  validateFinancialReceipt,
  type FinanceActor,
  type FinancialReceiptMetadata,
} from './financial-expense.service';

export const LEGACY_MIGRATION_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected'] as const;

export type LegacyMigrationPreparer = {
  actorType: 'admin' | 'staff';
  actorId: number;
  canReviewAll: boolean;
};

export function normalizeHistoricDate(value?: string | null) {
  if (!value?.trim()) return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('Historic purchase date must use YYYY-MM-DD.');
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) throw new Error('Historic purchase date is invalid.');
  if (parsed.getTime() > Date.now() + 86_400_000) throw new Error('Historic purchase date cannot be in the future.');
  return normalized;
}

export function normalizeLegacyServiceEnd(value?: string | null) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Timed-service end date is invalid.');
  return parsed.toISOString();
}

export function validateLegacyOriginalAmount(amountMinor?: number | null, currency?: string | null) {
  if (amountMinor == null && !currency?.trim()) return { amountMinor: null, currency: null };
  if (!Number.isSafeInteger(amountMinor) || Number(amountMinor) < 0) throw new Error('Historic amount must be zero or a positive minor-unit amount.');
  const normalizedCurrency = currency?.trim().toUpperCase();
  if (!normalizedCurrency || !/^[A-Z]{3}$/.test(normalizedCurrency)) throw new Error('Historic currency must use a three-letter code.');
  return { amountMinor: amountMinor!, currency: normalizedCurrency };
}

export function assertLegacyMigrationOwner(actor: FinanceActor | null) {
  if (!actor || actor.access !== 'owner' || actor.actorType !== 'admin') {
    throw new Error('Only the finance owner can approve or reject a legacy customer migration.');
  }
}

export function canAccessLegacyMigration(
  actor: LegacyMigrationPreparer,
  record: { createdByType: string; createdById: number },
) {
  return actor.canReviewAll || (record.createdByType === actor.actorType && record.createdById === actor.actorId);
}

export function buildLegacyMigrationReceiptMetadata(input: {
  migrationId: number;
  bytes: Uint8Array;
  declaredContentType?: string | null;
  originalName?: string | null;
  actor: { actorType: 'admin' | 'staff'; actorId: number };
  now?: Date;
  randomId?: string;
}): FinancialReceiptMetadata {
  const file = validateFinancialReceipt(input);
  const now = input.now ?? new Date();
  const randomId = input.randomId ?? crypto.randomUUID();
  return {
    version: 1,
    objectKey: `legacy-migration-receipts/${input.migrationId}/${now.getTime()}-${randomId}.${file.extension}`,
    originalName: file.originalName,
    contentType: file.contentType,
    sizeBytes: input.bytes.byteLength,
    uploadedAt: now.toISOString(),
    uploadedByType: input.actor.actorType,
    uploadedById: input.actor.actorId,
  };
}

export function parseLegacyMigrationReceiptMetadata(value?: string | null): FinancialReceiptMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<FinancialReceiptMetadata>;
    if (parsed.version !== 1
      || typeof parsed.objectKey !== 'string'
      || !parsed.objectKey.startsWith('legacy-migration-receipts/')
      || typeof parsed.originalName !== 'string'
      || typeof parsed.contentType !== 'string'
      || typeof parsed.sizeBytes !== 'number'
      || typeof parsed.uploadedAt !== 'string'
      || (parsed.uploadedByType !== 'admin' && parsed.uploadedByType !== 'staff')
      || !Number.isInteger(parsed.uploadedById)) return null;
    return parsed as FinancialReceiptMetadata;
  } catch {
    return null;
  }
}
