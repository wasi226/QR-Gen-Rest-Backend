import { StatusCodes } from 'http-status-codes';

export const notFound = (_req, res) => {
  return res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
  });
};

export const errorHandler = (err, req, res, next) => {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Something went wrong';

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
};
