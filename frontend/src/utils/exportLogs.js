const esc = (v) => String(v === null || v === undefined ? '' : v)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slug = (name) => name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

/* Excel export via SpreadsheetML (.xls) — opens natively in Excel / Google Sheets */
export function exportTableExcel(columns, rows, filename) {
  const head = '<Row>' + columns.map(c => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('') + '</Row>';
  const body = rows.map(r =>
    '<Row>' + r.map(c => {
      const num = typeof c === 'number' && isFinite(c);
      return `<Cell><Data ss:Type="${num ? 'Number' : 'String'}">${num ? c : esc(c)}</Data></Cell>`;
    }).join('') + '</Row>'
  ).join('');
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Data"><Table>${head}${body}</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slug(filename) + '.xls';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* PDF export via the browser print dialog — choose "Save as PDF" */
export function exportTablePdf(title, subtitle, columns, rows, filename) {
  const head = '<tr>' + columns.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
  const body = rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
  body { margin: 24px; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.meta { font-size: 11px; color: #64748b; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 9px; }
  th { background: #eef2f7; text-align: left; padding: 6px 8px; border: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: .04em; font-size: 8px; }
  td { padding: 5px 8px; border: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  @media print { @page { size: A4 landscape; margin: 10mm; } }
</style></head><body>
<h1>${esc(title)}</h1><p class="meta">${esc(subtitle)}</p>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
</body></html>`;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('afterprint', () => iframe.remove(), { once: true });
  win.focus();
  setTimeout(() => win.print(), 300);
}