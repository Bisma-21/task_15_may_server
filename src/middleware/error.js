export function notFound(req, res) {
  res.status(404).json({ error: 'not found' });
}

export function errorHandler(err, req, res, _next) {
  console.error('[error]', err);
  // Mongo duplicate key
  if (err && err.code === 11000) {
    return res.status(409).json({ error: 'duplicate value', fields: err.keyValue });
  }
  // Zod validation error
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'validation failed', issues: err.errors });
  }
  // Mongoose validation
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'validation failed', details: err.message });
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'server error' });
}
