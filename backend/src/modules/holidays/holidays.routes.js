const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('./holidays.controller');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const validate     = require('../../middleware/validate');
const { bulkHolidaySchema } = require('./holidays.validator');

// Memory storage — buffer passed directly to ExcelJS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.includes('spreadsheet') ||
               file.mimetype.includes('excel') ||
               file.originalname.endsWith('.xlsx') ||
               file.originalname.endsWith('.xls');
    cb(ok ? null : new Error('Only Excel files (.xlsx / .xls) are accepted'), ok);
  },
});

router.use(authenticate);

// GET  /holidays          — list (all authenticated)
router.get('/',        ctrl.list);

// POST /holidays/bulk     — manual JSON bulk upsert (RM only)
router.post('/bulk',   authorize('RESOURCE_MANAGER'), validate(bulkHolidaySchema), ctrl.bulkCreate);

// POST /holidays/upload   — Excel file upload (RM only)
router.post('/upload', authorize('RESOURCE_MANAGER'), upload.single('file'), ctrl.uploadExcel);

// DELETE /holidays/:id    — delete one (RM only)
router.delete('/:id',  authorize('RESOURCE_MANAGER'), ctrl.remove);

module.exports = router;
