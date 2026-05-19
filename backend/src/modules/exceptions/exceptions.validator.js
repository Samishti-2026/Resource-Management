const { z } = require('zod');

const createExceptionSchema = z.object({
  projectId: z.number().int().positive(),
  requestType: z.enum(['WEEKEND', 'HOLIDAY', 'BACKDATE', 'ALLOCATION_BREACH']),
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

module.exports = { createExceptionSchema };
