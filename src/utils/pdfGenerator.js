import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

/**
 * Render an array of fixed-size A4 DOM elements into a multi-page A4 PDF file.
 * Guarantee: Each element in `elements` maps 1:1 to exactly ONE PDF page (no cut-off or spillover).
 */
export async function exportA4ElementsToPdf({
  elements,
  filename = 'report.pdf',
  orientation = 'portrait',
  onProgress = null,
  returnBlobUrl = false
}) {
  if (!elements || elements.length === 0) {
    throw new Error('ไม่มีหน้าเอกสารสำหรับสร้างไฟล์ PDF');
  }

  // Wait for custom Thai fonts (Sarabun) and all embedded images (e.g. QR codes)
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  for (const el of elements) {
    const imgs = Array.from(el.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
  }

  const isLandscape = orientation === 'landscape';
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidthMm = isLandscape ? 297 : 210;
  const pageHeightMm = isLandscape ? 210 : 297;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (onProgress) onProgress(i + 1, elements.length);

    const elW = Math.max(el.offsetWidth || 794, 1);
    const elH = Math.max(el.offsetHeight || 1122, 1);

    const dataUrl = await toPng(el, {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: elW,
      height: elH,
      style: {
        margin: '0',
        marginLeft: '0',
        marginRight: '0',
        marginTop: '0',
        marginBottom: '0',
        boxShadow: 'none',
        border: 'none'
      },
      cacheBust: false,
      skipFonts: false
    });

    if (i > 0) {
      pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }

    const ratio = elH / elW;
    const targetRatio = pageHeightMm / pageWidthMm;
    let drawW = pageWidthMm;
    let drawH = pageWidthMm * ratio;
    let offsetX = 0;

    if (drawH > pageHeightMm + 0.5) {
      drawH = pageHeightMm;
      drawW = pageHeightMm / ratio;
      offsetX = (pageWidthMm - drawW) / 2;
    } else if (Math.abs(targetRatio - ratio) < 0.025) {
      drawH = pageHeightMm;
    }

    pdf.addImage(dataUrl, 'PNG', offsetX, 0, drawW, drawH, undefined, 'FAST');
  }

  if (returnBlobUrl) {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    return { pdf, blob, url };
  }

  pdf.save(filename);
  return { pdf };
}
