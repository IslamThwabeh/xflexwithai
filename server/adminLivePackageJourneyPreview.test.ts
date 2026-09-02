import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('../frontend/src/pages/AdminLivePackage.tsx', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('../frontend/src/components/admin/LivePackageJourneyPreview.tsx', import.meta.url), 'utf8');

describe('Admin Live Package full journey preview', () => {
  it('shows homepage, client registration, and accounting previews from the loaded admin workspace', () => {
    expect(pageSource).toContain('<LivePackageJourneyPreview data={data} isAr={isAr} />');
    expect(pageSource).toContain('owner can review it before the launch gates are fully configured');
    expect(previewSource).toContain("type PreviewStage = 'home' | 'registration' | 'accounting'");
    expect(previewSource).toContain('Client registration');
    expect(previewSource).toContain('Accounting report');
  });

  it('keeps the simulated journey local and documents when accounting recognizes the sale', () => {
    expect(previewSource).not.toContain('trpc.');
    expect(previewSource).not.toContain('fetch(');
    expect(previewSource).toContain('no data is saved or submitted');
    expect(previewSource).toContain('a sale enters accounting after payment approval and key activation');
  });
});
