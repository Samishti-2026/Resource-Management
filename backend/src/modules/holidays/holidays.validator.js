const { z } = require('zod');

const holidayItemSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d) => !isNaN(new Date(d).getTime()), 'Invalid date'),
  name: z.string()
    .min(2, 'Holiday name must be at least 2 characters')
    .max(100, 'Holiday name must be at most 100 characters')
    .trim(),
});

const bulkHolidaySchema = z.object({
  holidays: z.array(holidayItemSchema)
    .min(1, 'At least one holiday is required')
    .max(100, 'Cannot import more than 100 holidays at once'),
});

module.exports = { bulkHolidaySchema };
