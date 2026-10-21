import { useCallback, useState, type CSSProperties } from 'react';
import html2pdf from 'html2pdf.js';

export interface PdfExportOptions {
  filename?: string;
  marginMm?: number | [number, number, number, number];
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  scale?: number;
  width?: number;
}

const ARABIC_GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&family=Noto+Sans+Arabic:wght@400;500;600;700;800;900&display=swap';

/**
 * Host styling for off-screen / background PDF rendering.
 * Positioned behind the visible viewport at (0, 0) with z-index -99999 so html2canvas
 * can capture its layout accurately without clipping, while remaining invisible to the user.
 */
export const PDF_HOST_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  zIndex: -99999,
  pointerEvents: 'none',
  opacity: 1,
  overflow: 'visible',
};

/**
 * Returns page break style for multi-document batch PDF export.
 */
export function pdfPageBreak(index: number): CSSProperties {
  return index > 0
    ? { pageBreakBefore: 'always', breakBefore: 'page' }
    : {};
}

/**
 * Ensures supported Arabic Google Fonts (Cairo, Tajawal, Noto Sans Arabic) are embedded
 * and loaded in document.fonts before rendering to canvas.
 */
export async function ensureArabicFontsLoaded(): Promise<void> {
  // 1. Ensure the Google Fonts stylesheet is present in the DOM
  if (!document.querySelector('link[data-daftrk-arabic-fonts="true"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ARABIC_GOOGLE_FONTS_URL;
    link.setAttribute('data-daftrk-arabic-fonts', 'true');
    document.head.appendChild(link);
  }

  // 2. Pre-warm Arabic font glyph definitions
  if (document.fonts) {
    const fontsToLoad = [
      '400 14px "Cairo"',
      '600 14px "Cairo"',
      '700 14px "Cairo"',
      '800 14px "Cairo"',
      '400 14px "Tajawal"',
      '700 14px "Tajawal"',
      '400 14px "Noto Sans Arabic"',
      '700 14px "Noto Sans Arabic"',
    ];

    try {
      await Promise.all(fontsToLoad.map((f) => document.fonts.load(f).catch(() => null)));
      if (document.fonts.ready) {
        await document.fonts.ready;
      }
    } catch {
      // Continue even if network is restricted
    }
  }
}

/**
 * Exports an HTML element (or element ID) to a high-quality PDF file.
 * Handles font embedding, image loading, dark mode normalization, RTL text direction,
 * and fixes Arabic character detachment / ligature breaking.
 */
export async function exportElementToPdf(
  target: HTMLElement | string,
  options: PdfExportOptions = {}
): Promise<void> {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) {
    throw new Error('Target element not found for PDF export.');
  }

  // 1. Ensure all Arabic Google Fonts are loaded
  await ensureArabicFontsLoaded();

  // 2. Ensure all images inside target are completely loaded
  const images = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );

  const rawFilename = options.filename?.trim() || 'document.pdf';
  const filename = rawFilename.toLowerCase().endsWith('.pdf') ? rawFilename : `${rawFilename}.pdf`;

  // Standard A4 width in px at 96 DPI: 210mm * 3.7795 px/mm ≈ 794px
  const standardA4Width = options.width ?? 794;

  // 3. Inject temporary PDF capture styling to fix Arabic cursive ligatures,
  // ensure zero letter-spacing on Arabic characters, and maintain proper RTL layout.
  const styleId = `pdf-export-style-${Date.now()}`;
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = `
    .daftrk-pdf-export-active {
      width: ${standardA4Width}px !important;
      max-width: ${standardA4Width}px !important;
      min-width: ${standardA4Width}px !important;
      box-sizing: border-box !important;
      background-color: #ffffff !important;
      color: #1e293b !important;
      margin: 0 !important;
      font-feature-settings: "liga" 1, "calt" 1, "clig" 1 !important;
      text-rendering: geometricPrecision !important;
      -webkit-font-smoothing: antialiased !important;
    }
    .daftrk-pdf-export-active * {
      letter-spacing: 0 !important;
      word-spacing: normal !important;
      font-feature-settings: "liga" 1, "calt" 1, "clig" 1 !important;
      text-rendering: geometricPrecision !important;
    }
    .daftrk-pdf-export-active[dir="rtl"],
    .daftrk-pdf-export-active [dir="rtl"],
    .daftrk-pdf-export-rtl,
    .daftrk-pdf-export-rtl * {
      direction: rtl !important;
      font-family: 'Cairo', 'Tajawal', 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif !important;
    }
    .daftrk-pdf-export-active table {
      border-collapse: collapse !important;
      page-break-inside: avoid !important;
      width: 100% !important;
    }
    .daftrk-pdf-export-active tr,
    .daftrk-pdf-export-active .print-no-break {
      page-break-inside: avoid !important;
    }
  `;
  document.head.appendChild(styleEl);

  const isRtl =
    el.getAttribute('dir') === 'rtl' ||
    document.documentElement.getAttribute('dir') === 'rtl' ||
    window.getComputedStyle(el).direction === 'rtl';

  // Temporarily force light theme & PDF export styling
  const isDark = document.documentElement.classList.contains('dark');
  const originalClasses = el.className;
  const originalStyleWidth = el.style.width;
  const originalStyleMaxWidth = el.style.maxWidth;

  el.classList.add('daftrk-pdf-export-active');
  if (isRtl) el.classList.add('daftrk-pdf-export-rtl');
  if (isDark) {
    el.classList.remove('dark');
    el.classList.add('light');
  }

  const opt = {
    margin: options.marginMm ?? [6, 6, 6, 6],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: options.scale ?? 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      letterRendering: false, // CRITICAL: NEVER true! letterRendering=true breaks Arabic ligatures into detached letters
      scrollX: 0,
      scrollY: 0,
      width: standardA4Width,
      windowWidth: standardA4Width,
    },
    jsPDF: {
      unit: 'mm',
      format: options.format ?? 'a4',
      orientation: options.orientation ?? 'portrait',
      compress: true,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    await html2pdf().from(el).set(opt).save();
  } finally {
    // Clean up temporary styles and classes
    el.className = originalClasses;
    el.style.width = originalStyleWidth;
    el.style.maxWidth = originalStyleMaxWidth;
    const injected = document.getElementById(styleId);
    if (injected) injected.remove();
  }
}

export interface StartExportParams extends PdfExportOptions {
  hostId: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook for managing asynchronous PDF exports from off-screen host elements.
 */
export function usePdfExport() {
  const [exporting, setExporting] = useState(false);

  const startExport = useCallback(async (params: StartExportParams) => {
    setExporting(true);
    try {
      // Allow React to commit the off-screen DOM tree
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(() => resolve(), 80);
        });
      });

      const host = document.getElementById(params.hostId);
      if (!host) {
        throw new Error(`PDF host element #${params.hostId} not found.`);
      }

      await exportElementToPdf(host, {
        filename: params.filename,
        marginMm: params.marginMm,
        orientation: params.orientation,
        format: params.format,
        scale: params.scale,
        width: params.width,
      });

      params.onSuccess?.();
    } catch (err) {
      console.error('PDF export error:', err);
      params.onError?.(err);
    } finally {
      setExporting(false);
    }
  }, []);

  return { startExport, exporting };
}

/**
 * Triggers clean browser printing for an element without opening an about:blank popup.
 */
export function printElement(elementId: string): void {
  const target = document.getElementById(elementId);
  if (!target) {
    window.print();
    return;
  }
  window.print();
}
