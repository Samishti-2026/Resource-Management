const { z } = require('zod');

const createAllocationSchema = z.object({
  employeeId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  allocatedHours: z.number().positive('Allocated hours must be positive'),
});

const updateAllocationSchema = z.object({
  allocatedHours: z.number().positive().optional(),
});

module.exports = { createAllocationSchema, updateAllocationSchema };
