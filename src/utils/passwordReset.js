import crypto from 'node:crypto';
import { sendMail } from './email.js';

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
  if (user.email) {
    await sendMail({
      to: user.email,
      subject: 'Your Password Reset Code',
      text: `Your password reset code is: ${code}`,
      html: `<p>Your password reset code is: <b>${code}</b></p>`
    });
    console.log(`Password reset code sent to ${user.email}`);
  } else {
    console.log(`Password reset code for ${user.username}: ${code} (no email on file)`);
  }
}
