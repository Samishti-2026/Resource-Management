const ExcelJS = require('exceljs');
const { format } = require('date-fns');

/**
 * Generate employee timesheet report as Excel buffer
 */
async function generateEmployeeReport(data, employeeName, from, to) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Timesheet System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Timesheet Report');

  // Header styling
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
    alignment: { horizontal: 'center' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  // Title
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Timesheet Report — ${employeeName}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = `Period: ${format(new Date(from), 'dd MMM yyyy')} to ${format(new Date(to), 'dd MMM yyyy')}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  // Column headers
  const headerRow = sheet.addRow(['Date', 'Day', 'Project', 'Hours', 'Status', 'Week Start', 'Week End', 'Notes']);
  headerRow.eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });

  sheet.columns = [
    { key: 'date',      width: 15 },
    { key: 'day',       width: 12 },
    { key: 'project',   width: 30 },
    { key: 'hours',     width: 10 },
    { key: 'status',    width: 15 },
    { key: 'weekStart', width: 15 },
    { key: 'weekEnd',   width: 15 },
    { key: 'notes',     width: 35 },
  ];

  // Data rows
  data.forEach((row, idx) => {
    const entryDate  = new Date(row.entryDate);
    const weekStart  = new Date(row.weekStart);
    const weekEnd    = new Date(new Date(row.weekStart).setDate(weekStart.getDate() + 6));
    const dataRow = sheet.addRow({
      date:      format(entryDate,  'dd MMM yyyy'),
      day:       format(entryDate,  'EEE'),
      project:   row.projectName,
      hours:     row.hours,
      status:    row.status,
      weekStart: format(weekStart,  'dd MMM yyyy'),
      weekEnd:   format(weekEnd,    'dd MMM yyyy'),
      notes:     row.notes || '',
    });

    if (idx % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }
  });

  // Summary row
  const totalHours = data.reduce((sum, r) => sum + r.hours, 0);
  sheet.addRow([]);
  const summaryRow = sheet.addRow(['', 'TOTAL', totalHours, '', '', '']);
  summaryRow.getCell(1).font = { bold: true };
  summaryRow.getCell(2).font = { bold: true };
  summaryRow.getCell(3).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

/**
 * Generate utilization report
 */
async function generateUtilizationReport(data, from, to) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Utilization Report');

  sheet.mergeCells('A1:E1');
  sheet.getCell('A1').value = `Organization Utilization Report — ${format(new Date(from), 'dd MMM yyyy')} to ${format(new Date(to), 'dd MMM yyyy')}`;
  sheet.getCell('A1').font = { bold: true, size: 13 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  sheet.addRow([]);

  const headerRow = sheet.addRow(['Employee', 'Allocated Hours', 'Used Hours', 'Utilization %', 'Status']);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center' };
  });

  sheet.columns = [
    { key: 'employee', width: 25 },
    { key: 'allocated', width: 18 },
    { key: 'used', width: 15 },
    { key: 'pct', width: 15 },
    { key: 'status', width: 15 },
  ];

  data.forEach((row) => {
    const pct = row.utilizationPct;
    const dataRow = sheet.addRow({
      employee: row.employeeName,
      allocated: row.allocatedHours,
      used: row.usedHours,
      pct: `${pct}%`,
      status: pct >= 80 ? 'On Track' : pct >= 50 ? 'Moderate' : 'Low',
    });

    const pctCell = dataRow.getCell(4);
    if (pct >= 80) {
      pctCell.font = { color: { argb: 'FF16A34A' } };
    } else if (pct < 50) {
      pctCell.font = { color: { argb: 'FFDC2626' } };
    }
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateEmployeeReport, generateUtilizationReport };
