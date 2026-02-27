import crypto from 'crypto';
import { User } from '../models/User.js';
import { ApiError } from './apiError.js';

const RESET_CODE_EXPIRY_MINUTES = 15;

const resetCodes = new Map(); // username -> { code, expiresAt }

export function generateResetCode(username) {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000;
  resetCodes.set(username, { code, expiresAt });
  return code;
}

export function validateResetCode(username, code) {
  const entry = resetCodes.get(username);
  if (!entry) return false;
  if (entry.code !== code) return false;
  if (Date.now() > entry.expiresAt) {
    resetCodes.delete(username);
    return false;
  }
  return true;
}

export function clearResetCode(username) {
  resetCodes.delete(username);
}

export async function sendResetCode(user, code) {
  // For demo: log to console. In production, send email/SMS.
  console.log(`Password reset code for ${user.username}: ${code}`);
  // TODO: Integrate email/SMS provider here.
}
