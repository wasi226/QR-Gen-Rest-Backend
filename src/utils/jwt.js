import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      username: user.username,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);
