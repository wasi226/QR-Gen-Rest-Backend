const missingPaymentEnvVars = ['UPI_ID', 'PAYEE_NAME'].filter((key) => !process.env[key]);

if (missingPaymentEnvVars.length > 0) {
  throw new Error(`Missing required payment environment variables: ${missingPaymentEnvVars.join(', ')}`);
}

export const paymentConfig = {
  upiId: process.env.UPI_ID,
  payeeName: process.env.PAYEE_NAME,
  currency: 'INR',
};

