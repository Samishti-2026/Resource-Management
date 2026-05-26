const { z } = require('zod');

const createTimesheetSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
});

const entrySchema = z.object({
  projectId: z.number().int().positive(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'entryDate must be YYYY-MM-DD'),
  hours:     z.number().min(0.5, 'Minimum 0.5 hours per entry').max(12, 'Maximum 12 hours per entry'),
  notes:     z.string().max(500).optional(),
});

const saveEntriesSchema = z.object({
  entries: z.array(entrySchema).min(0),
  remarks: z.string().max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters').max(500),
});

const approveSchema = z.object({
  remarks: z.string().max(500).optional(),
});

module.exports = { createTimesheetSchema, saveEntriesSchema, rejectSchema, approveSchema };
