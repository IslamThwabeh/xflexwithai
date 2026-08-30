import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contact = readFileSync(new URL('../frontend/src/pages/Contact.tsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../frontend/src/components/public/CinematicPublicLayout.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../frontend/src/pages/CinematicHomePage.tsx', import.meta.url), 'utf8');

describe('approved public-copy boundaries', () => {
  it('uses the exact Arabic office address and appointment-only language', () => {
    for (const source of [contact, footer]) {
      expect(source).toContain('مجمع قطوم التجاري، الطابق الرابع، البالوع');
      expect(source).toContain('الزيارات متاحة بموعد مسبق فقط.');
      expect(source).toContain('Office visits in Ramallah are available by appointment only.');
    }
  });

  it('removes unsupported public volume and popularity claims', () => {
    expect(home).not.toMatch(/value:\s*5000/);
    expect(home).not.toContain('+5,000');
    expect(home).not.toContain('Most requested');
    expect(home).not.toContain('الأكثر طلباً');
    expect(home).not.toContain('أكاديمية التداول الأولى في فلسطين');
    expect(home).not.toContain('Daily signals');
    expect(home).not.toContain('End-to-end protection');
  });
});
