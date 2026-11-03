const walletMethod = prefix => {
  const accountName = String(process.env[`${prefix}_ACCOUNT_NAME`] || '').trim();
  const accountNumber = String(process.env[`${prefix}_ACCOUNT_NUMBER`] || '').trim();
  return {
    enabled: Boolean(accountName && accountNumber),
    accountName,
    accountNumber,
  };
};

export const paymentMethods = () => ({
  cod: { enabled: true },
  jazzcash: walletMethod('JAZZCASH'),
  easypaisa: walletMethod('EASYPAISA'),
});

export const isPaymentMethodAvailable = method => Boolean(paymentMethods()[method]?.enabled);
