#!/usr/bin/env node
/**
 * Test Data Seed Script
 * Populates the "Test" checking account with 26 months of realistic transactions
 * (Jan 2024 – Feb 2026) covering all categories every month.
 *
 * Run: node backend/seeds/test-data.js
 */

const { Pool } = require('pg');
const { randomUUID, createHash } = require('crypto');

function txHash(row) {
  return createHash('sha256')
    .update(`${row.merchant_raw ?? ''}${row.description_raw ?? ''}${row.merchant_clean ?? ''}${row.amount_cents}${row.posted_at}USD`)
    .digest('hex');
}

// ─── Config ──────────────────────────────────────────────────────────────────

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DB || 'budgetdb',
  user: process.env.POSTGRES_USER || 'budget',
  password: process.env.POSTGRES_PASSWORD || 'budgetpass',
});

const USER_ID = '00000000-0000-0000-0000-000000000000';
const TEST_ACCOUNT_ID = 'fd2f70b7-1a1c-4bd1-8485-fcb90ea8e5e4';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function d(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Seeded pseudo-random: deterministic so re-runs produce same data */
let seed = 42;
function rng() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0xffffffff;
}

function rand(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Spread day within range, avoiding weekends if possible for bank transactions
function spreadDay(baseDay, maxDay) {
  return Math.min(baseDay + rand(0, 2), maxDay);
}

// ─── Transaction Builder ──────────────────────────────────────────────────────

function tx(posted_at, cents, type, category_id, merchant_raw, merchant_clean, extra = '') {
  return {
    posted_at,
    amount_cents: cents,
    type,
    category_id,
    merchant_raw,
    merchant_clean,
    text_for_embedding: `${merchant_raw} ${extra} ${category_id}`.trim(),
  };
}

// ─── Monthly Transaction Generator ───────────────────────────────────────────

function generateMonth(year, month) {
  const maxDay = daysInMonth(year, month);
  const cap = (day) => Math.min(day, maxDay);
  const rows = [];

  const isSummer = month >= 6 && month <= 8;
  const isWinter = month === 12 || month <= 2;
  const isHoliday = month === 12;
  const isTaxSeason = month === 3 || month === 4;
  const isBackToSchool = month === 8 || month === 9;
  const isSpring = month >= 3 && month <= 5;

  // ── INCOME ──────────────────────────────────────────────────────────────────

  // Biweekly salary (varies ±$200 per paycheck for bonuses/overtime)
  const paycheck1 = 348000 + rand(-10000, 25000);
  const paycheck2 = 348000 + rand(-10000, 15000);
  rows.push(tx(d(year, month, 1),  paycheck1, 'income', 'salary',
    'DIRECT DEP ACME CORP PAYROLL', 'Acme Corp Payroll', 'salary paycheck direct deposit'));
  rows.push(tx(d(year, month, 15), paycheck2, 'income', 'salary',
    'DIRECT DEP ACME CORP PAYROLL', 'Acme Corp Payroll', 'salary paycheck direct deposit'));

  // Annual bonus in February
  if (month === 2) {
    rows.push(tx(d(year, month, 10), 450000 + rand(0, 100000), 'income', 'salary',
      'DIRECT DEP ACME CORP BONUS', 'Acme Corp Bonus', 'annual bonus income'));
  }

  // Tax refund in March/April
  if (month === 3) {
    rows.push(tx(d(year, month, 12), 145000 + rand(0, 75000), 'income', 'tax-refund',
      'IRS TREAS 310 TAX REF', 'IRS Tax Refund', 'federal tax refund IRS'));
  }

  // Freelance / Zelle income quarterly
  if ([1, 4, 7, 10].includes(month)) {
    rows.push(tx(d(year, month, cap(18)), 75000 + rand(0, 125000), 'income', 'zelle',
      `ZELLE PMT FROM FREELANCE CLIENT`, 'Zelle Freelance', 'zelle payment freelance income'));
  }

  // Rental income in select months (odd months)
  if ([3, 6, 9, 12].includes(month)) {
    rows.push(tx(d(year, month, cap(3)), 120000, 'income', 'rent-payment',
      'ZELLE PMT FROM ROOMMATE ALEX', 'Roommate Rent', 'rent payment roommate zelle'));
  }

  // ── HOUSING ─────────────────────────────────────────────────────────────────

  rows.push(tx(d(year, month, 2), -185000, 'expense', 'housing',
    'OAKWOOD APTS RENT PMT', 'Oakwood Apartments', 'rent housing apartment'));

  // ── CAR PAYMENT ─────────────────────────────────────────────────────────────

  rows.push(tx(d(year, month, 5), -42000, 'expense', 'car-payment',
    'ALLY FINANCIAL AUTO LOAN', 'Ally Financial Auto Loan', 'car payment auto loan'));

  // ── PHONE ───────────────────────────────────────────────────────────────────

  rows.push(tx(d(year, month, 8), -8499, 'expense', 'phone',
    'TMOBILE*AUTO PAY', 'T-Mobile', 'phone bill mobile wireless'));

  // ── INSURANCE ───────────────────────────────────────────────────────────────

  rows.push(tx(d(year, month, 6), -28000, 'expense', 'insurance',
    'BLUE SHIELD HEALTH INS', 'Blue Shield Health Insurance', 'health insurance premium'));
  rows.push(tx(d(year, month, 6), -12500, 'expense', 'insurance',
    'PROGRESSIVE AUTO INS', 'Progressive Auto Insurance', 'car auto insurance'));
  rows.push(tx(d(year, month, 7), -2200, 'expense', 'insurance',
    'LEMONADE RENTERS INS', 'Lemonade Renters Insurance', 'renters insurance home'));

  // ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────

  // Netflix price increases over time
  const netflixPrice = year >= 2025 ? -2299 : -1799;
  rows.push(tx(d(year, month, 3), netflixPrice, 'expense', 'subscriptions',
    'NETFLIX.COM', 'Netflix', 'netflix streaming subscription'));
  rows.push(tx(d(year, month, 3), -1099, 'expense', 'subscriptions',
    'SPOTIFY USA', 'Spotify', 'spotify music streaming subscription'));
  rows.push(tx(d(year, month, 4), -5999, 'expense', 'subscriptions',
    'ADOBE CREATIVE CLOUD', 'Adobe Creative Cloud', 'adobe design software subscription'));
  rows.push(tx(d(year, month, 9), -4900, 'expense', 'subscriptions',
    'EQUINOX FITNESS', 'Equinox Gym', 'gym fitness membership subscription'));
  rows.push(tx(d(year, month, cap(22)), -1799, 'expense', 'subscriptions',
    'HULU*SUBSCRIPTION', 'Hulu', 'hulu streaming tv subscription'));
  // Amazon Prime annual (January only)
  if (month === 1) {
    rows.push(tx(d(year, month, cap(20)), -13999, 'expense', 'subscriptions',
      'AMAZON PRIME MEMBERSHIP', 'Amazon Prime', 'amazon prime annual membership subscription'));
  }
  // iCloud storage
  rows.push(tx(d(year, month, cap(11)), -299, 'expense', 'subscriptions',
    'APPLE.COM/BILL ICLOUD+', 'Apple iCloud+', 'icloud storage apple subscription'));

  // ── UTILITIES ────────────────────────────────────────────────────────────────

  // Electric: higher in summer (AC) and winter (heating)
  const electricBase = isHoliday ? 18500 : isSummer ? 17000 : isWinter ? 16000 : 10500;
  rows.push(tx(d(year, month, cap(14)), -(electricBase + rand(0, 3000)), 'expense', 'utilities',
    'PG&E ELECTRIC BILL', 'PG&E Electric', 'electric utility bill power'));

  // Gas utility: much higher in winter
  const gasUtilBase = isWinter ? 11000 : isSummer ? 2500 : 5500;
  rows.push(tx(d(year, month, cap(14)), -(gasUtilBase + rand(0, 2000)), 'expense', 'utilities',
    'PG&E GAS BILL', 'PG&E Gas', 'gas utility bill heating'));

  rows.push(tx(d(year, month, cap(16)), -(4500 + rand(0, 1000)), 'expense', 'utilities',
    'COMCAST XFINITY INTERNET', 'Comcast Xfinity Internet', 'internet bill broadband'));
  rows.push(tx(d(year, month, cap(20)), -(3800 + rand(0, 800)), 'expense', 'utilities',
    'CITY WATER SEWER BILL', 'City Water & Sewer', 'water sewer utility bill'));

  // ── GROCERIES ────────────────────────────────────────────────────────────────

  const groceryStores = [
    ['WHOLEFDS MKT', 'Whole Foods Market'],
    ['TRADER JOES #123', "Trader Joe's"],
    ['COSTCO WHSE #0456', 'Costco Wholesale'],
    ['SAFEWAY #1234', 'Safeway'],
    ['TARGET GROCERY', 'Target Grocery'],
  ];

  // 4-5 grocery trips per month
  const groceryDays = [3, 9, 16, 23, cap(29)];
  groceryDays.forEach((day, i) => {
    const [raw, clean] = groceryStores[i % groceryStores.length];
    const isHolidayShop = isHoliday && i === 3;
    const amount = isHolidayShop ? rand(14000, 22000) : rand(5500, 15500);
    rows.push(tx(d(year, month, day), -amount, 'expense', 'groceries',
      raw, clean, 'grocery food shopping'));
  });

  // ── DINING ──────────────────────────────────────────────────────────────────

  const restaurants = [
    ['CHIPOTLE MEXICAN GRILL', 'Chipotle', 'burrito bowl fast food'],
    ['STARBUCKS #12345', 'Starbucks', 'coffee latte drink'],
    ['SWEETGREEN', 'Sweetgreen', 'salad lunch healthy food'],
    ['SUSHI ROKU', 'Sushi Roku', 'sushi japanese dinner restaurant'],
    ['PIZZERIA DELFINA', 'Pizzeria Delfina', 'pizza italian dinner'],
    ['IN-N-OUT BURGER', 'In-N-Out Burger', 'burger fast food lunch'],
    ['THE CHEESECAKE FACTORY', 'The Cheesecake Factory', 'dinner restaurant family'],
    ['BLUE BOTTLE COFFEE', 'Blue Bottle Coffee', 'coffee breakfast cafe'],
  ];
  const diningAmounts = [1450, 625, 1350, 6800, 3200, 1150, 7500, 580];
  const diningDays = [2, 5, 8, 12, 17, 21, 25, cap(28)];
  // More dining out in summer, fewer in winter
  const diningCount = isSummer ? 8 : isWinter ? 5 : 6;
  for (let i = 0; i < diningCount; i++) {
    const [raw, clean, extra] = restaurants[i % restaurants.length];
    rows.push(tx(d(year, month, diningDays[i % diningDays.length] + (i > 5 ? 1 : 0)),
      -(diningAmounts[i % diningAmounts.length] + rand(-200, 400)),
      'expense', 'dining', raw, clean, extra));
  }

  // ── DELIVERY ────────────────────────────────────────────────────────────────

  const deliveryApps = [
    ['DOORDASH*DELIVERY', 'DoorDash', 'food delivery restaurant order'],
    ['UBER EATS*ORDER', 'Uber Eats', 'food delivery order app'],
    ['INSTACART DELIVERY', 'Instacart', 'grocery delivery service'],
  ];
  const deliveryDays = [4, 11, 18, cap(25)];
  const deliveryCount = isWinter ? 4 : isSummer ? 2 : 3;
  for (let i = 0; i < deliveryCount; i++) {
    const [raw, clean, extra] = deliveryApps[i % deliveryApps.length];
    rows.push(tx(d(year, month, deliveryDays[i]),
      -(rand(2800, 5500)),
      'expense', 'delivery', raw, clean, extra));
  }

  // ── TRANSPORTATION ──────────────────────────────────────────────────────────

  // Gas (2x/month)
  rows.push(tx(d(year, month, cap(7)),  -(rand(5000, 8500)), 'expense', 'transportation',
    'SHELL OIL 12345678', 'Shell Gas Station', 'gas fuel vehicle transportation'));
  rows.push(tx(d(year, month, cap(21)), -(rand(4800, 7800)), 'expense', 'transportation',
    'CHEVRON 00123456', 'Chevron Gas Station', 'gas fuel vehicle transportation'));

  // Uber/Lyft (more in winter — less driving)
  const rideCount = isWinter ? 4 : isSummer ? 2 : 3;
  const rideDays = [6, 13, 20, cap(27)];
  for (let i = 0; i < rideCount; i++) {
    const [raw, clean] = rand(0, 1) === 0
      ? ['UBER *TRIP', 'Uber Ride']
      : ['LYFT *RIDE', 'Lyft Ride'];
    rows.push(tx(d(year, month, rideDays[i]), -(rand(1200, 4500)), 'expense', 'transportation',
      raw, clean, 'uber lyft rideshare transportation'));
  }

  // Parking occasionally
  if (month % 2 === 0) {
    rows.push(tx(d(year, month, cap(15)), -(rand(800, 2500)), 'expense', 'transportation',
      'SPOTHERO PARKING', 'SpotHero Parking', 'parking garage downtown transportation'));
  }

  // ── HEALTHCARE ──────────────────────────────────────────────────────────────

  // Doctor copay
  rows.push(tx(d(year, month, cap(10)), -(rand(3000, 5500)), 'expense', 'healthcare',
    'KAISER PERMANENTE COPAY', 'Kaiser Permanente', 'doctor visit copay medical'));
  // Pharmacy
  rows.push(tx(d(year, month, cap(19)), -(rand(1500, 7800)), 'expense', 'healthcare',
    'CVS PHARMACY #1234', 'CVS Pharmacy', 'pharmacy prescription medicine'));
  // Dental (twice a year)
  if (month === 6) {
    rows.push(tx(d(year, month, cap(14)), -(rand(15000, 30000)), 'expense', 'healthcare',
      'BRIGHT NOW DENTAL', 'Bright Now Dental', 'dental cleaning checkup'));
  }
  if (month === 12) {
    rows.push(tx(d(year, month, cap(8)), -(rand(18000, 35000)), 'expense', 'healthcare',
      'BRIGHT NOW DENTAL', 'Bright Now Dental', 'dental cleaning checkup'));
  }
  // Vision (once a year)
  if (month === 4) {
    rows.push(tx(d(year, month, cap(22)), -(rand(20000, 45000)), 'expense', 'healthcare',
      'LENSCRAFTERS VISION', 'LensCrafters', 'glasses contacts eye exam vision'));
  }

  // ── PERSONAL CARE ───────────────────────────────────────────────────────────

  // Haircut every other month
  if (month % 2 === 1) {
    rows.push(tx(d(year, month, cap(12)), -(rand(3500, 6500)), 'expense', 'personal-care',
      'GREAT CLIPS HAIRCUT', 'Great Clips', 'haircut barber personal care grooming'));
  } else {
    rows.push(tx(d(year, month, cap(12)), -(rand(4500, 8500)), 'expense', 'personal-care',
      'SPORT CLIPS HAIRCUTS', 'Sport Clips', 'haircut salon personal care grooming'));
  }
  // Personal care products
  rows.push(tx(d(year, month, cap(17)), -(rand(2200, 5500)), 'expense', 'personal-care',
    'ULTA BEAUTY', 'Ulta Beauty', 'beauty skincare personal care products'));

  // ── ENTERTAINMENT ───────────────────────────────────────────────────────────

  const entertainment = [
    ['AMC THEATRES', 'AMC Theatres', 'movie theater entertainment'],
    ['BOWLING ALLEY & BAR', 'Bowlero', 'bowling entertainment fun'],
    ['EVENTBRITE EVENT', 'Eventbrite', 'event ticket concert entertainment'],
    ['PLAYSTATION STORE', 'PlayStation Store', 'video game gaming entertainment'],
    ['TICKETMASTER', 'Ticketmaster', 'concert ticket live event entertainment'],
  ];
  const entCount = isSummer ? 4 : isWinter ? 3 : 3;
  const entDays = [4, 10, 18, cap(24)];
  for (let i = 0; i < entCount; i++) {
    const [raw, clean, extra] = entertainment[i % entertainment.length];
    rows.push(tx(d(year, month, entDays[i % entDays.length]),
      -(rand(1500, 9500)), 'expense', 'entertainment', raw, clean, extra));
  }
  // Summer concert / special event
  if (isSummer) {
    rows.push(tx(d(year, month, cap(20)), -(rand(8000, 22000)), 'expense', 'entertainment',
      'GOLDEN GATE PARK CONCERT', 'Golden Gate Park Concert', 'outdoor concert summer entertainment'));
  }

  // ── SHOPPING ────────────────────────────────────────────────────────────────

  const shops = [
    ['AMAZON.COM*ORDER', 'Amazon', 'online shopping order'],
    ['TARGET.COM', 'Target', 'retail shopping household'],
    ['BEST BUY 1234', 'Best Buy', 'electronics gadget shopping'],
    ['TJ MAXX', 'TJ Maxx', 'clothing apparel shopping'],
    ['HOME DEPOT', 'Home Depot', 'hardware home improvement shopping'],
    ['NORDSTROM', 'Nordstrom', 'clothing fashion department store shopping'],
  ];
  // Holiday shopping spike in November/December
  const shopCount = isHoliday ? 6 : month === 11 ? 5 : 3;
  const shopDays = [3, 8, 14, 19, cap(24), cap(27)];
  for (let i = 0; i < shopCount; i++) {
    const [raw, clean, extra] = shops[i % shops.length];
    const amount = isHoliday ? rand(4500, 25000) : rand(2500, 18000);
    rows.push(tx(d(year, month, shopDays[i]),
      -amount, 'expense', 'shopping', raw, clean, extra));
  }

  // ── EDUCATION ───────────────────────────────────────────────────────────────

  // Online course or book
  const eduVendors = [
    ['UDEMY COURSE PURCHASE', 'Udemy', 'online course education learning'],
    ['COURSERA SUBSCRIPTION', 'Coursera', 'online course education learning'],
    ['AMAZON KINDLE BOOK', 'Amazon Kindle', 'ebook book reading education'],
    ['LINKEDIN LEARNING', 'LinkedIn Learning', 'professional development education'],
  ];
  const [eduRaw, eduClean, eduExtra] = eduVendors[month % eduVendors.length];
  rows.push(tx(d(year, month, cap(13)), -(rand(999, 4999)), 'expense', 'education',
    eduRaw, eduClean, eduExtra));
  // Back to school supplies
  if (isBackToSchool) {
    rows.push(tx(d(year, month, cap(22)), -(rand(3500, 9500)), 'expense', 'education',
      'STAPLES OFFICE SUPPLY', 'Staples', 'office supplies back to school education'));
  }
  // Annual conference ticket
  if (month === 5) {
    rows.push(tx(d(year, month, cap(15)), -(rand(45000, 120000)), 'expense', 'education',
      'TECH CONF TICKET PURCHASE', 'Tech Conference', 'conference professional development education'));
  }

  // ── PET EXPENSE ─────────────────────────────────────────────────────────────

  rows.push(tx(d(year, month, cap(9)), -(rand(3500, 7500)), 'expense', 'pet-expense',
    'PETSMART #1234', 'PetSmart', 'pet food supplies dog cat'));
  // Vet quarterly
  if ([1, 4, 7, 10].includes(month)) {
    rows.push(tx(d(year, month, cap(23)), -(rand(8500, 28000)), 'expense', 'pet-expense',
      'BANFIELD PET HOSPITAL', 'Banfield Pet Hospital', 'veterinarian vet pet health'));
  } else {
    rows.push(tx(d(year, month, cap(23)), -(rand(1500, 4500)), 'expense', 'pet-expense',
      'PETCO STORE #456', 'Petco', 'pet treats toys accessories'));
  }

  // ── TRAVEL ──────────────────────────────────────────────────────────────────

  // Heavy travel in summer and December
  if (isSummer) {
    rows.push(tx(d(year, month, cap(5)), -(rand(35000, 95000)), 'expense', 'travel',
      pick(['DELTA AIR LINES', 'UNITED AIRLINES', 'SOUTHWEST AIRLINES']),
      pick(['Delta Air Lines', 'United Airlines', 'Southwest Airlines']),
      'flight airplane travel vacation'));
    rows.push(tx(d(year, month, cap(6)), -(rand(18000, 55000)), 'expense', 'travel',
      'AIRBNB ACCOMMODATION', 'Airbnb', 'accommodation hotel stay travel'));
    rows.push(tx(d(year, month, cap(8)), -(rand(8000, 25000)), 'expense', 'travel',
      'ENTERPRISE RENT-A-CAR', 'Enterprise Rent-A-Car', 'car rental travel vacation'));
  } else if (isHoliday) {
    rows.push(tx(d(year, month, cap(20)), -(rand(42000, 110000)), 'expense', 'travel',
      'DELTA AIR LINES', 'Delta Air Lines', 'flight holiday travel home'));
    rows.push(tx(d(year, month, cap(21)), -(rand(15000, 40000)), 'expense', 'travel',
      'MARRIOTT HOTELS', 'Marriott Hotels', 'hotel stay holiday travel'));
  } else {
    // Light travel: occasional Airbnb weekend or bus trip
    rows.push(tx(d(year, month, cap(isSummer ? 10 : 16)), -(rand(8000, 32000)), 'expense', 'travel',
      pick(['AIRBNB *STAY', 'GREYHOUND BUS TICKET', 'AMTRAK TICKET']),
      pick(['Airbnb', 'Greyhound Bus', 'Amtrak']),
      'weekend trip travel accommodation'));
  }

  // ── FEES & SERVICES ─────────────────────────────────────────────────────────

  // ATM fee or bank fee occasionally
  if (month % 3 === 0) {
    rows.push(tx(d(year, month, cap(15)), -(rand(200, 500)), 'expense', 'fees--services',
      'ATM WITHDRAWAL FEE', 'ATM Fee', 'atm fee bank charge'));
  }
  // Annual credit card fee (January)
  if (month === 1) {
    rows.push(tx(d(year, month, cap(5)), -9500, 'expense', 'fees--services',
      'CHASE SAPPHIRE ANNUAL FEE', 'Chase Sapphire Annual Fee', 'credit card annual fee charge'));
  }
  // Tax prep (February)
  if (month === 2) {
    rows.push(tx(d(year, month, cap(8)), -(rand(12000, 25000)), 'expense', 'fees--services',
      'H&R BLOCK TAX SERVICES', 'H&R Block', 'tax preparation services fee'));
  }

  // ── REFUNDS (occasional) ────────────────────────────────────────────────────

  // Amazon refund every other month
  if (month % 2 === 0) {
    rows.push(tx(d(year, month, cap(16)), rand(1500, 8000), 'refund', 'shopping',
      'AMAZON.COM*REFUND', 'Amazon Refund', 'amazon return refund shopping'));
  }
  // Occasional subscription refund
  if (month === 6 || month === 11) {
    rows.push(tx(d(year, month, cap(22)), rand(999, 3999), 'refund', 'subscriptions',
      'NETFLIX CREDIT', 'Netflix Credit', 'netflix refund credit subscription'));
  }

  // ── TRANSFERS ───────────────────────────────────────────────────────────────

  // Credit card payment
  rows.push(tx(d(year, month, cap(18)), -(rand(85000, 135000)), 'transfer', 'credit-card-payment',
    'ONLINE PAYMENT CHASE CARD', 'Chase Credit Card Payment', 'credit card payment transfer'));

  // Transfer to savings
  rows.push(tx(d(year, month, cap(25)), -(rand(30000, 75000)), 'transfer', 'fund-account',
    'TRANSFER TO SAVINGS ACCT', 'Transfer to Savings', 'savings transfer fund account'));

  // Investment contribution (quarterly)
  if ([1, 4, 7, 10].includes(month)) {
    rows.push(tx(d(year, month, cap(26)), -(rand(50000, 100000)), 'transfer', 'investment',
      'VANGUARD INVESTMENT CONTRIB', 'Vanguard Investment', 'investment brokerage transfer'));
  }

  return rows;
}

// ─── Main Seeder ─────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if Test account exists
    const accResult = await client.query(
      'SELECT id, name FROM accounts WHERE id = $1',
      [TEST_ACCOUNT_ID]
    );
    if (accResult.rows.length === 0) {
      throw new Error(`Test account ${TEST_ACCOUNT_ID} not found. Please create it first.`);
    }
    console.log(`✓ Using account: "${accResult.rows[0].name}" (${TEST_ACCOUNT_ID})`);

    // Clean up any existing seed data for this account
    console.log('Removing existing seed data for Test account…');
    await client.query(
      `DELETE FROM import_batches
       WHERE user_id = $1
         AND id IN (
           SELECT DISTINCT import_batch_id FROM transactions WHERE account_id = $2
         )`,
      [USER_ID, TEST_ACCOUNT_ID]
    );

    // Create a seed import batch (required FK)
    const batchId = randomUUID();
    await client.query(
      `INSERT INTO import_batches
         (id, user_id, status, total_rows, embedded_rows, auto_categorized_rows, needs_review_rows, completed_at)
       VALUES ($1, $2, 'completed', 0, 0, 0, 0, now())`,
      [batchId, USER_ID]
    );
    console.log(`✓ Created import batch: ${batchId}`);

    // Generate 26 months: Jan 2024 – Feb 2026
    let totalInserted = 0;
    for (let m = 0; m < 26; m++) {
      const year  = 2024 + Math.floor((m) / 12);
      const month = ((m) % 12) + 1;
      const rows  = generateMonth(year, month);

      for (const row of rows) {
        await client.query(
          `INSERT INTO transactions
             (user_id, import_batch_id, account_id, posted_at, amount_cents, currency,
              merchant_raw, merchant_clean, text_for_embedding, type, category_id,
              category_source, category_confidence, needs_review, tx_hash)
           VALUES ($1,$2,$3,$4,$5,'USD',$6,$7,$8,$9,$10,'manual',0.99,false,$11)
           `,
          [
            USER_ID, batchId, TEST_ACCOUNT_ID,
            row.posted_at, row.amount_cents,
            row.merchant_raw, row.merchant_clean, row.text_for_embedding,
            row.type, row.category_id,
            txHash(row),
          ]
        );
        totalInserted++;
      }

      console.log(`  ${year}-${String(month).padStart(2,'0')}: ${rows.length} transactions`);
    }

    // Update batch total_rows
    await client.query(
      'UPDATE import_batches SET total_rows = $1 WHERE id = $2',
      [totalInserted, batchId]
    );

    await client.query('COMMIT');
    console.log(`\n✅ Done. Inserted ~${totalInserted} transactions across 26 months.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
