import PDFDocument from 'pdfkit';

export function generateMenuPdf(products, businessName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 60;
    let currentY = 30;

    function checkPageBreak(needed) {
      if (currentY + needed > doc.page.height - 50) {
        doc.addPage();
        currentY = 30;
      }
    }

    // ── Header ──
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text(businessName || 'Menú', 30, currentY, { align: 'center', width: pageWidth });
    currentY += 35;

    doc.moveTo(30, currentY).lineTo(doc.page.width - 30, currentY).strokeColor('#1e3a5f').lineWidth(1.5).stroke();
    currentY += 15;

    // ── Products ──
    const categories = {};
    for (const p of products) {
      const cat = p.category || 'General';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    }

    const catNames = Object.keys(categories).sort();
    for (const cat of catNames) {
      const items = categories[cat];

      checkPageBreak(40);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2d6a4f')
        .text(cat, 30, currentY);
      currentY += 20;

      doc.moveTo(30, currentY).lineTo(doc.page.width - 30, currentY)
        .strokeColor('#2d6a4f').lineWidth(0.5).stroke();
      currentY += 8;

      for (const p of items) {
        checkPageBreak(60);
        const rowStart = currentY;
        const name = `${p.emoji || '🔹'} ${p.name}`;
        const priceStr = p.price ? `$${Number(p.price).toLocaleString('es-AR')}` : '';
        const desc = p.description || '';

        // Image
        let imgWidth = 0;
        if (p.image) {
          try {
            const imgData = p.image.split(',')[1] || p.image;
            doc.image(Buffer.from(imgData, 'base64'), 30, currentY, { width: 45, height: 45 });
            imgWidth = 55;
          } catch (e) {
            console.warn(`[menu-pdf] Error loading image for "${p.name}": ${e.message}`);
          }
        }

        // Name + price (render them first to measure height)
        const textX = 30 + imgWidth;
        const textWidth = pageWidth - imgWidth;

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a')
          .text(name, textX, currentY, { width: textWidth - 70 });

        if (priceStr) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f')
            .text(priceStr, textX + (textWidth - 70) + 5, currentY, { width: 65, align: 'right' });
        }

        let rowHeight = Math.max(imgWidth ? 50 : 0, doc.y - currentY);
        currentY += rowHeight + 2;

        // Description
        if (desc) {
          doc.fontSize(9).font('Helvetica').fillColor('#666')
            .text(desc, textX, currentY, { width: textWidth });
          currentY = doc.y + 4;
        } else {
          currentY += 4;
        }

        // Separator
        doc.moveTo(textX, currentY).lineTo(doc.page.width - 30, currentY)
          .strokeColor('#e0e0e0').lineWidth(0.3).stroke();
        currentY += 6;
      }

      currentY += 10;
    }

    // ── Footer ──
    if (currentY > doc.page.height - 60) {
      doc.addPage();
      currentY = doc.page.height - 40;
    }
    doc.fontSize(8).font('Helvetica').fillColor('#999')
      .text(`Generado por BotAr — ${new Date().toLocaleDateString('es-AR')}`, 30, currentY, { align: 'center', width: pageWidth });

    doc.end();
  });
}
