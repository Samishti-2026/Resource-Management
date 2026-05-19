const { z } = require('zod');

const createTimesheetSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
});

const entrySchema = z.object({
  projectId: z.number().int().positive(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.5).max(12),
  notes: z.string().max(500).optional(),
});

const saveEntriesSchema = z.object({
  entries: z.array(entrySchema).min(0),
});

const rejectSchema = z.object({
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters'),
});

module.exports = { createTimesheetSchema, saveEntriesSchema, rejectSchema };
