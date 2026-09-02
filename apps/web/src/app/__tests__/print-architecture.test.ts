/**
 * Print Architecture Regression Tests (BUG-002)
 *
 * Verifies that @media print CSS rules exist in globals.css and that
 * shell elements (sidebar, header, POS buttons) carry the `no-print`
 * class so they are hidden during printing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const globalsCssPath = path.join(process.cwd(), 'src', 'app', 'globals.css');
const layoutPath = path.join(
  process.cwd(),
  'src',
  'app',
  '(authenticated)',
  'layout.tsx'
);
const posReceiptPath = path.join(
  process.cwd(),
  'src',
  'features',
  'pos',
  'components',
  'POSReceiptCard.tsx'
);
const posViewmodelPath = path.join(
  process.cwd(),
  'src',
  'features',
  'pos',
  'use-pos-viewmodel.ts'
);

describe('PRINT-ARCH-001: @media print hides shell elements', () => {
  it('globals.css contains @media print block with .no-print { display: none }', () => {
    const css = readFileSync(globalsCssPath, 'utf8');
    expect(css).toContain('@media print');
    expect(css).toMatch(/\.no-print\s*\{[^}]*display:\s*none[^}]*\}/);
    expect(css).toMatch(/\.print-only\s*\{[^}]*display:\s*block[^}]*\}/);
  });

  it('globals.css print rule uses !important for .no-print display', () => {
    const css = readFileSync(globalsCssPath, 'utf8');
    expect(css).toMatch(/\.no-print\s*\{[^}]*display:\s*none[^}]*!important[^}]*\}/);
  });
});

describe('PRINT-ARCH-002: shell elements carry no-print class', () => {
  it('authenticated layout applies no-print to Sidebar and Header', () => {
    const source = readFileSync(layoutPath, 'utf8');
    expect(source).toContain('className="no-print"');
  });

  it('POSReceiptCard applies no-print to print/new transaction buttons', () => {
    const source = readFileSync(posReceiptPath, 'utf8');
    const noPrintCount = (source.match(/no-print/g) || []).length;
    expect(noPrintCount).toBeGreaterThanOrEqual(2);
  });
});

describe('PRINT-ARCH-003: triggerPrint respects no-print guard', () => {
  it('use-pos-viewmodel.ts triggerPrint checks for no-print class before calling window.print', () => {
    const source = readFileSync(posViewmodelPath, 'utf8');
    expect(source).toContain("classList.contains('no-print')");
    expect(source).toContain('window.print');
  });
});
