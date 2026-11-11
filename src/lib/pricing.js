export const isValidDiscountPercent = value => {
  const percent = Number(value);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 && Number(percent.toFixed(2)) === percent;
};

export const discountedPrice = (price, percent) => {
  const amount = Number(price);
  const rate = Number(percent);
  if (!Number.isFinite(amount) || amount < 0 || !isValidDiscountPercent(rate)) {
    throw new RangeError('Price and discount percentage must be valid non-negative values.');
  }
  if (rate === 0) return amount;
  return Math.round((amount * (100 - rate)) / 1000) * 10;
};
