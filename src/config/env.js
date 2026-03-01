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
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  mongoUri: process.env.MONGO_URI,
  frontendUrl: process.env.FRONTEND_URL,
  frontendUrls,
  orderNumberStart: process.env.ORDER_NUMBER_START,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  recoverySecret: process.env.RECOVERY_SECRET,
  defaultAdminUsername: process.env.DEFAULT_OWNER_USERNAME,
  defaultAdminPassword: process.env.DEFAULT_OWNER_PASSWORD,
  defaultKitchenUsername: process.env.DEFAULT_KITCHEN_USERNAME,
  defaultKitchenPassword: process.env.DEFAULT_KITCHEN_PASSWORD,
  upiId: process.env.UPI_ID,
  payeeName: process.env.PAYEE_NAME,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpSecure: process.env.SMTP_SECURE,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM,
};
