const holidaysService = require('./holidays.service');
const { success, created, error } = require('../../utils/apiResponse');
const ExcelJS = require('exceljs');

const list = async (req, res, next) => {
  try {
    const holidays = await holidaysService.listHolidays(req.query);
    return success(res, holidays);
  } catch (err) { next(err); }
};

const bulkCreate = async (req, res, next) => {
  try {
    const holidays = await holidaysService.bulkCreateHolidays(req.body.holidays, req.user.id);
    return created(res, holidays, `${holidays.length} holidays saved`);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await holidaysService.deleteHoliday(parseInt(req.params.id), req.user.id);
    return success(res, null, 'Holiday deleted');
  } catch (err) { next(err); }
};

/**
 * Upload holidays from Excel file.
 * Expected columns (any order, header row required):
 *   Date (dd/mm/yyyy or yyyy-mm-dd)  |  Holiday Name
 * Maximum 500 data rows processed per upload.
 */
const MAX_EXCEL_ROWS = 500;

const uploadExcel = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) return error(res, 'Excel file has no sheets', 400);

    // Find header row — look for a row containing "date" and "name" (case-insensitive)
    let headerRowNum = 1;
    let dateCol = 1;
    let nameCol = 2;

    sheet.eachRow((row, rowNum) => {
      const vals = row.values.map((v) => (v ? String(v).toLowerCase().trim() : ''));
      const dIdx = vals.findIndex((v) => v.includes('date'));
      const nIdx = vals.findIndex((v) => v.includes('name') || v.includes('holiday'));
      if (dIdx > 0 && nIdx > 0) {
        headerRowNum = rowNum;
        dateCol = dIdx;
        nameCol = nIdx;
      }
    });

    const holidays = [];
    let dataRowCount = 0;
    sheet.eachRow((row, rowNum) => {
      if (rowNum <= headerRowNum) return; // skip header
      if (dataRowCount >= MAX_EXCEL_ROWS) return; // cap rows to prevent memory exhaustion
      const rawDate = row.getCell(dateCol).value;
      const rawName = row.getCell(nameCol).value;
      if (!rawDate || !rawName) return;

      let parsedDate;
      if (rawDate instanceof Date) {
        parsedDate = rawDate;
      } else {
        // Try dd/mm/yyyy or yyyy-mm-dd
        const str = String(rawDate).trim();
        const parts = str.split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // yyyy-mm-dd
            parsedDate = new Date(`${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`);
          } else {
            // dd/mm/yyyy
            parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
          }
        }
      }

      if (!parsedDate || isNaN(parsedDate.getTime())) return;

      const yyyy = parsedDate.getFullYear();
      const mm   = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd   = String(parsedDate.getDate()).padStart(2, '0');

      // Enforce max name length (matches bulkHolidaySchema)
      const name = String(rawName).trim().slice(0, 100);
      holidays.push({ date: `${yyyy}-${mm}-${dd}`, name });
      dataRowCount++;
    });

    if (holidays.length === 0) {
      return error(res, 'No valid holidays found in the file. Ensure columns are "Date" and "Holiday Name".', 400);
    }

    const saved = await holidaysService.bulkCreateHolidays(holidays, req.user.id);
    return created(res, saved, `${saved.length} holidays imported from Excel`);
  } catch (err) { next(err); }
};

module.exports = { list, bulkCreate, remove, uploadExcel };
