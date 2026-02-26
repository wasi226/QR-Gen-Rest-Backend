import dotenv from 'dotenv';

dotenv.config();

const parseOrigins = (value) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const configuredOrigins = [
  ...parseOrigins(process.env.FRONTEND_URLS),
  ...parseOrigins(process.env.FRONTEND_URL),
];

const defaultOrigins = ['http://localhost:5173', 'https://sabasweets.vercel.app'];

const frontendUrls = [...new Set([...configuredOrigins, ...defaultOrigins])];

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  frontendUrl: frontendUrls[0],
  frontendUrls,
  orderNumberStart: Number(process.env.ORDER_NUMBER_START) || 1000,
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME,
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD,
  defaultKitchenUsername: process.env.DEFAULT_KITCHEN_USERNAME,
  defaultKitchenPassword: process.env.DEFAULT_KITCHEN_PASSWORD,
  recoverySecret: process.env.RECOVERY_SECRET || 'change-me-in-production',
};
