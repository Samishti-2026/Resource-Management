const { z } = require('zod');

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
  projectManagerId: z.number().int().positive('Project Manager ID is required'),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  projectManagerId: z.number().int().positive().optional(),
});

const addMemberSchema = z.object({
  employeeId: z.number().int().positive('Employee ID is required'),
});

module.exports = { createProjectSchema, updateProjectSchema, addMemberSchema };
