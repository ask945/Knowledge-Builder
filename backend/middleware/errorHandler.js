const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }
  if (err.code === 11000) {
    return res.status(400).json({ success: false, error: 'Duplicate field value entered' });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ success: false, error: messages.join(', ') });
  }

  res.status(500).json({ success: false, error: 'Server Error' });
};

module.exports = errorHandler;
