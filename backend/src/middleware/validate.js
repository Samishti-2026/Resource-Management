const { badRequest } = require('../utils/apiResponse');

/**
 * Zod schema validation middleware
 * Usage: validate(schema) — validates req.body
 * Usage: validate(schema, 'query') — validates req.query
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return badRequest(res, 'Validation failed', errors);
    }
    req[source] = result.data; // replace with parsed/coerced data
    next();
  };
};

module.exports = validate;
