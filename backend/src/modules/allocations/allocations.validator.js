const { z } = require('zod');

const createAllocationSchema = z.object({
  employeeId:     z.number().int().positive(),
  projectId:      z.number().int().positive(),
  allocatedHours: z.number()
    .positive('Allocated hours must be positive')
    .max(2000, 'Allocated hours cannot exceed 2000'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
}).refine((d) => new Date(d.endDate) > new Date(d.startDate), {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

const updateAllocationSchema = z.object({
  allocatedHours: z.number().positive().max(2000).optional(),
  startDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((d) => {
  if (d.startDate && d.endDate) return new Date(d.endDate) > new Date(d.startDate);
  return true;
}, {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

module.exports = { createAllocationSchema, updateAllocationSchema };
