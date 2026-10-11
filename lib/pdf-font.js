import 'regenerator-runtime/runtime';
import fs from 'fs';
import path from 'path';
import { StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Embeds the self-hosted Noto Sans Bengali font (Bangla script) for
// invoice/report PDFs. Latin text uses the built-in Helvetica — the
// Bengali font has no Latin glyphs, and pdf-lib does no automatic
// per-glyph fallback, so mixed text is drawn run-by-run with
// drawMixedText().
// Falls back to Helvetica only when the font file is unavailable.
export async function embedFonts(pdfDoc) {
  pdfDoc.registerFontkit(fontkit);
  let bangla = null;
  let banglaBold = null;
  try {
    const dir = path.join(process.cwd(), 'public', 'fonts');
    bangla = await pdfDoc.embedFont(fs.readFileSync(path.join(dir, 'NotoSansBengali-Regular.ttf')));
    banglaBold = await pdfDoc.embedFont(fs.readFileSync(path.join(dir, 'NotoSansBengali-Bold.ttf')));
  } catch {
    bangla = null;
    banglaBold = null;
  }
  const latin = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return {
    font: bangla || latin,
    boldFont: banglaBold || latinBold,
    bangla,
    banglaBold,
    latin,
    latinBold,
  };
}

const BANGLA_RE = /[\u0980-\u09FF]/;

// Draw text that may mix Bangla and Latin characters, choosing the
// correct embedded font for each run and advancing x by each run's
// real width. Usage:
//   drawMixedText(page, `Customer: ${name}`, { x: 50, y, size: 10, fonts })
export function drawMixedText(page, text, { x, y, size, fonts, bold = false, color }) {
  const pick = (isBangla) => {
    if (isBangla) {
      const f = bold ? fonts.banglaBold : fonts.bangla;
      return f || (bold ? fonts.latinBold : fonts.latin);
    }
    return bold ? fonts.latinBold : fonts.latin;
  };

  let cx = x;
  let run = '';
  let runIsBangla = null;

  const flush = () => {
    if (!run) return;
    const f = pick(runIsBangla);
    const opts = { x: cx, y, size, font: f };
    if (color) opts.color = color;
    page.drawText(run, opts);
    cx += f.widthOfTextAtSize(run, size);
    run = '';
  };

  for (const ch of text) {
    const isBangla = BANGLA_RE.test(ch);
    if (runIsBangla === null) runIsBangla = isBangla;
    if (isBangla !== runIsBangla) {
      flush();
      runIsBangla = isBangla;
    }
    run += ch;
  }
  flush();
}
