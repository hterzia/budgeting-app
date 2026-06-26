interface TransactionInput {
  merchantClean?: string;
  descriptionRaw?: string;
  amountCents: number;
  type?: string;
}

interface KeywordResult {
  categoryId: string | null;
  confidence: number;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: [
    'grocery', 'supermarket', 'whole foods', 'trader joe', 'aldi', 'kroger',
    'safeway', 'publix', 'wegmans', 'costco', 'target', 'walmart',
    'food lion', 'heb', 'meijer', 'sprouts', 'market basket',
  ],
  dining: [
    'restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'mcdonald',
    'chipotle', 'subway', 'pizza', 'burger', 'taco', 'sushi',
    'grubhub', 'doordash', 'uber eats', 'postmates', 'diner',
    'bar', 'grill', 'kitchen', 'bistro', 'bakery', 'panda express',
  ],
  transportation: [
    'gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'mobil',
    'uber', 'lyft', 'taxi', 'parking', 'toll', 'transit', 'metro',
    'amtrak', 'greyhound', 'auto', 'car wash', 'jiffy lube',
  ],
  utilities: [
    'electric', 'water', 'gas bill', 'internet', 'comcast', 'att',
    'verizon', 'tmobile', 't-mobile', 'spectrum', 'xfinity', 'phone',
    'utility', 'power', 'energy', 'sewer', 'trash', 'waste',
  ],
  housing: [
    'rent', 'mortgage', 'rocket mortgage', 'newrez', 'home',
    'apartment', 'property', 'hoa', 'home depot', 'lowes',
    'maintenance', 'repair', 'plumber', 'electrician',
  ],
  healthcare: [
    'doctor', 'hospital', 'pharmacy', 'cvs', 'walgreen', 'medical',
    'dental', 'dentist', 'optometrist', 'vision', 'health', 'clinic',
    'urgent care', 'lab', 'prescription', 'rx',
  ],
  entertainment: [
    'netflix', 'hulu', 'disney', 'spotify', 'apple music', 'youtube',
    'movie', 'theater', 'cinema', 'concert', 'ticket', 'game',
    'steam', 'playstation', 'xbox', 'nintendo', 'twitch',
  ],
  shopping: [
    'amazon', 'ebay', 'etsy', 'retail', 'store', 'shop', 'mall',
    'clothing', 'apparel', 'nike', 'adidas', 'nordstrom', 'macys',
    'best buy', 'electronics', 'ikea', 'wayfair',
  ],
  travel: [
    'hotel', 'airbnb', 'vrbo', 'flight', 'airline', 'delta',
    'united', 'american airlines', 'southwest', 'jetblue',
    'booking', 'expedia', 'kayak', 'rental car', 'hertz', 'avis',
  ],
  insurance: [
    'insurance', 'geico', 'state farm', 'allstate', 'progressive',
    'liberty mutual', 'premium', 'policy',
  ],
  education: [
    'tuition', 'university', 'college', 'school', 'course', 'udemy',
    'coursera', 'textbook', 'student',
  ],
  'personal-care': [
    'haircut', 'salon', 'barber', 'gym', 'fitness', 'spa',
    'beauty', 'cosmetic', 'nail', 'massage',
  ],
  subscriptions: [
    'membership', 'monthly plan', 'annual plan', 'recurring charge',
    'patreon', 'substack', 'adobe creative', 'microsoft 365',
    'google one', 'icloud storage', 'dropbox plus',
  ],
  salary: [
    'payroll', 'paycheck', 'direct deposit', 'employer', 'salary',
    'wage', 'compensation', 'adp', 'gusto', 'paychex',
  ],
  transfers: [
    'zelle', 'venmo', 'cashapp', 'cash app', 'paypal', 'wire',
    'ach', 'transfer', 'credit card payment', 'cc payment',
  ],
};

export function keywordCategorize(
  tx: TransactionInput,
  validCategoryIds: Set<string>
): KeywordResult {
  const text = `${tx.merchantClean ?? ''} ${tx.descriptionRaw ?? ''}`.toLowerCase();

  if (tx.type === 'income' && validCategoryIds.has('salary')) {
    return { categoryId: 'salary', confidence: 0.7 };
  }

  let bestCategory: string | null = null;
  let bestScore = 0;

  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!validCategoryIds.has(categoryId)) continue;

    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryId;
    }
  }

  if (bestScore >= 3 && bestCategory) {
    return { categoryId: bestCategory, confidence: Math.min(0.95, bestScore / 20) };
  }

  return { categoryId: null, confidence: 0 };
}

export function keywordCategorizeBatch(
  transactions: Array<TransactionInput & { id: number }>,
  validCategoryIds: Set<string>
): Map<number, { categoryId: string; confidence: number }> {
  const results = new Map<number, { categoryId: string; confidence: number }>();

  for (const tx of transactions) {
    const result = keywordCategorize(tx, validCategoryIds);
    if (result.categoryId) {
      results.set(tx.id, { categoryId: result.categoryId, confidence: result.confidence });
    }
  }

  return results;
}
