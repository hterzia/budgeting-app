export function formatCurrency(amount: number, options: { compact?: boolean; currency?: string } = {}) {
  const { compact = false, currency = 'USD' } = options;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Retro-futuristic currency formatter with monospace digits
export function formatRetroCurrency(amount: number, options: { currency?: string; monospace?: boolean } = {}) {
  const { currency = 'USD', monospace = true } = options;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  // Wrap in span with monospace font for retro digital display effect
  if (monospace) {
    return `<span class="font-mono">${formatted}</span>`;
  }
  return formatted;
}

export function formatPercentage(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
  }).format(value / 100);
}
