const { z } = require('zod');

const createUserSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email:    z.string().email('Invalid email').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  roleId:   z.number().int().positive(),
});

const updateUserSchema = z.object({
  name:     z.string().min(2).max(100).trim().optional(),
  roleId:   z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

const assignSkillsSchema = z.object({
  skillIds: z.array(z.number().int().positive()).min(0).max(20, 'Cannot assign more than 20 skills'),
});

module.exports = { createUserSchema, updateUserSchema, assignSkillsSchema };
