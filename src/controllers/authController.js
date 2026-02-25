import { StatusCodes } from 'http-status-codes';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';

const ALLOWED_ROLES = ['ADMIN', 'KITCHEN'];

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'username and password are required.');
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const user = await User.findOne({ username: normalizedUsername });

  if (!user || !user.active) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials.');
  }

  const isPasswordValid = await user.comparePassword(String(password));
  if (!isPasswordValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials.');
  }

  const token = signAccessToken(user);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      token,
      user: user.toSafeObject(),
    },
  });
});

export const bootstrapAdmin = asyncHandler(async (req, res) => {
  const existingUsers = await User.countDocuments();

  if (existingUsers > 0) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Bootstrap is disabled after the first account is created.'
    );
  }

  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'username and password are required.');
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  if (!normalizedUsername) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid username is required.');
  }

  const user = await User.create({
    username: normalizedUsername,
    password: String(password),
    role: 'ADMIN',
  });

  const token = signAccessToken(user);

  return res.status(StatusCodes.CREATED).json({
    success: true,
    data: {
      token,
      user: user.toSafeObject(),
    },
  });
});

export const registerUser = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'username, password and role are required.');
  }

  const normalizedRole = String(role).trim().toUpperCase();
  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `role must be one of ${ALLOWED_ROLES.join(', ')}`);
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const existingUser = await User.findOne({ username: normalizedUsername });
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'A user with this username already exists.');
  }

  const user = await User.create({
    username: normalizedUsername,
    password: String(password),
    role: normalizedRole,
  });

  return res.status(StatusCodes.CREATED).json({
    success: true,
    data: user.toSafeObject(),
  });
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    data: user.toSafeObject(),
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'userId and newPassword are required.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  user.password = String(newPassword);
  await user.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: 'Password reset successfully.',
    data: user.toSafeObject(),
  });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body;

  if (!currentPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'currentPassword is required for security.');
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Verify current password before allowing changes
  const isPasswordValid = await user.comparePassword(String(currentPassword));
  if (!isPasswordValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Current password is incorrect.');
  }

  // Update username if provided
  if (newUsername) {
    const normalizedUsername = String(newUsername).trim().toLowerCase();
    const existingUser = await User.findOne({ username: normalizedUsername, _id: { $ne: user._id } });
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Username already taken.');
    }
    user.username = normalizedUsername;
  }

  // Update password if provided
  if (newPassword) {
    user.password = String(newPassword);
  }

  await user.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: 'Profile updated successfully.',
    data: user.toSafeObject(),
  });
});

export const recoverPassword = asyncHandler(async (req, res) => {
  const { username, recoveryCode, newPassword } = req.body;

  if (!username || !recoveryCode || !newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'username, recoveryCode and newPassword are required.'
    );
  }

  // Verify recovery code
  if (recoveryCode !== env.recoverySecret) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid recovery code.');
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const user = await User.findOne({ username: normalizedUsername });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Update password without verification of old password
  user.password = String(newPassword);
  await user.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: 'Password recovered successfully. Please log in with your new password.',
    data: user.toSafeObject(),
  });
});
