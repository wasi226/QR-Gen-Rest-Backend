import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Configure the transporter using environment variables for security
const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure === 'true', // true for 465, false for other ports
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass,
  },
});

export async function sendMail({ to, subject, text, html }) {
  const info = await transporter.sendMail({
    from: env.smtpFrom || env.smtpUser,
    to,
    subject,
    text,
    html,
  });
  return info;
}
