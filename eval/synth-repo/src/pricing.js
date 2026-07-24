// Branch-heavy pricing logic. Intentionally has NO tests at all (0% coverage).
export function discountedPrice(price, quantity, customerTier) {
  if (price < 0) throw new Error('price must be non-negative');
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer');
  let discount = 0;
  if (quantity >= 100) discount = 0.2;
  else if (quantity >= 10) discount = 0.1;
  if (customerTier === 'gold') discount += 0.05;
  else if (customerTier === 'silver') discount += 0.02;
  if (discount > 0.25) discount = 0.25;
  const total = price * quantity * (1 - discount);
  return Math.round(total * 100) / 100;
}

export function taxFor(total, region) {
  if (total < 0) throw new Error('total must be non-negative');
  switch (region) {
    case 'EU': return total * 0.21;
    case 'US': return total * 0.08;
    case 'UK': return total * 0.2;
    default: return 0;
  }
}
