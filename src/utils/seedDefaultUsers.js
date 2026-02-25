import { env } from '../config/env.js';
import { User } from '../models/User.js';

const ensureUser = async ({ username, password, role }) => {
  const normalizedUsername = username.trim().toLowerCase();
  const existing = await User.findOne({ username: normalizedUsername });

  if (existing) {
    if (existing.role !== role) {
      existing.role = role;
      await existing.save();
    }
    return;
  }

  await User.create({
    username: normalizedUsername,
    password,
    role,
  });
};

export const seedDefaultUsers = async () => {
  const hasAdminSeed = env.defaultAdminUsername && env.defaultAdminPassword;
  const hasKitchenSeed = env.defaultKitchenUsername && env.defaultKitchenPassword;

  if (!hasAdminSeed && !hasKitchenSeed) {
    return;
  }

  if (hasAdminSeed) {
    await ensureUser({
      username: env.defaultAdminUsername,
      password: env.defaultAdminPassword,
      role: 'ADMIN',
    });
  }

  if (hasKitchenSeed) {
    await ensureUser({
      username: env.defaultKitchenUsername,
      password: env.defaultKitchenPassword,
      role: 'KITCHEN',
    });
  }
};
