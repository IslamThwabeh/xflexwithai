/**
 * Print-to-PDF utility for report pages.
 * Opens a styled print window with the report content.
 */
export function printReport(title: string) {
  // Add print-specific styles and trigger browser print
  const style = document.createElement('style');
  style.id = 'print-report-style';
  style.textContent = `
    @media print {
      nav, header, aside, .no-print, [data-no-print],
      button:not(.print-include), .print\\:hidden {
        display: none !important;
      }
      body { 
        font-size: 12px;
        color: #000;
        background: #fff;
      }
      .print-title::before {
        content: "${title} — ${new Date().toLocaleDateString()}";
        display: block;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 16px;
        text-align: center;
      }
      table { 
        width: 100% !important;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #ccc;
        padding: 4px 8px;
        text-align: start;
      }
      th { background: #f3f3f3; }
      .bg-gradient-to-br, .bg-green-500, .bg-green-700 {
        background: #f3f3f3 !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
  document.head.appendChild(style);
  window.print();
  // Cleanup after print
  setTimeout(() => {
    const el = document.getElementById('print-report-style');
    if (el) el.remove();
  }, 1000);
}
