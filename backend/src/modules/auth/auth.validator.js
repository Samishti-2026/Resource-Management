const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// refreshToken is now sent via HttpOnly cookie.
// Body field is kept optional for backwards-compatibility during migration.
const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

module.exports = { loginSchema, refreshSchema };
