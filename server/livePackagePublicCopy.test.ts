import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contact = readFileSync(new URL('../frontend/src/pages/Contact.tsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../frontend/src/components/public/CinematicPublicLayout.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../frontend/src/pages/CinematicHomePage.tsx', import.meta.url), 'utf8');
const packageDetails = readFileSync(new URL('../frontend/src/pages/PackageDetails.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../frontend/src/pages/LivePackageWorkspace.tsx', import.meta.url), 'utf8');

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

  it('promotes open Live registration near the top of the homepage', () => {
    expect(home).toContain('بكج لايف متاح الآن — التسجيل لفترة محدودة');
    expect(home).toContain('function FeaturedLivePackageSection()');
    expect(home).toContain('if (!liveState?.purchasable) return null;');
    expect(home.indexOf('<FeaturedLivePackageSection />')).toBeLessThan(home.indexOf('<StickyStorySection />'));
    expect(home.indexOf('<FeaturedLivePackageSection />')).toBeLessThan(home.indexOf('<PackagesSection />'));
  });

  it('describes the standalone service without course or invented-date promises', () => {
    for (const source of [home, packageDetails, workspace]) {
      expect(source).not.toMatch(/base-course content|assigned base course|المحتوى التعليمي الأساسي/i);
    }
    expect(home).toContain('Four live sessions weekly for three months');
    expect(home).toContain('start date and schedule will be announced once approved');
    expect(packageDetails).toContain('Two educational and two live trading/analysis sessions weekly for three months');
  });

  it('gives a useful bilingual state before the first schedule is published', () => {
    expect(workspace).toContain("data.cohortStatus === 'not_started'");
    expect(workspace).toContain('Schedule will be announced');
    expect(workspace).toContain('سيُعلن الجدول قريباً');
    expect(workspace).toContain('no action is required from you now');
  });

  it('keeps the package-detail return button readable on its white card', () => {
    expect(packageDetails).toContain('bg-white px-4 text-slate-700 hover:bg-slate-50 hover:text-slate-950');
  });
});
