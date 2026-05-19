const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: z.number().int().positive(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  roleId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const assignSkillsSchema = z.object({
  skillIds: z.array(z.number().int().positive()).min(0),
});

module.exports = { createUserSchema, updateUserSchema, assignSkillsSchema };
