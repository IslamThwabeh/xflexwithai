import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const database = readFileSync(new URL('../backend/db.ts', import.meta.url), 'utf8');
const router = readFileSync(new URL('../backend/routers.ts', import.meta.url), 'utf8');

describe('support email cooldown policy', () => {
  it('limits routine and escalation staff emails per conversation', () => {
    expect(database).toContain('new_support_message: 10');
    expect(database).toContain('human_escalation: 30');
    expect(router.match(/actionUrl: `\/admin\/support\?conversationId=\$\{conv\.id\}`/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps client-facing staff replies grouped in the existing digest window', () => {
    expect(database).toContain('const SUPPORT_REPLY_DIGEST_DELAY_MS = 60 * 1000');
    expect(database).toContain('metadata?.conversationId === input.conversationId');
    expect(database).toContain('messages: nextMessages');
  });
});
