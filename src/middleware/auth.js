import { StatusCodes } from 'http-status-codes';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/jwt.js';

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication token is required.');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (_error) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'User account is not available.');
  }

  req.user = {
    id: String(user._id),
    username: user.username,
    role: user.role,
  };

  return next();
});

export const requireRoles = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication is required.');
  }

  if (!allowedRoles.includes(req.user.role)) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not allowed to access this resource.');
  }

  return next();
};
