const { z } = require('zod');

const createSkillSchema = z.object({
  name: z.string()
    .min(2, 'Skill name must be at least 2 characters')
    .max(50, 'Skill name must be at most 50 characters')
    .trim(),
  description: z.string().max(200).optional(),
});

const updateSkillSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  description: z.string().max(200).optional(),
});

module.exports = { createSkillSchema, updateSkillSchema };
