import { useState, useEffect } from 'react';
import { ThemeRow } from './CardTheme';
import { ThemeHeader } from './ThemeLabel';

// Sample themes to display (in order)
const themeOrder = [
  'brutallyMinimal',
  'maximalistChaos',
  'retroFuturistic',
  'organicNatural',
  'luxuryRefined',
  'playfulToyLike',
  'editorialMagazine',
  'brutalistRaw',
  'artDecoGeometric',
  'softPastel',
  'industrialUtilitarian',
  'darkTheme',
] as const;

type ThemeKey = typeof themeOrder[number];

// Helper to generate random sample data
function generateSampleData(): {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  refund?: number;
} {
  const income = Math.floor(Math.random() * 8000) + 2000; // 2000-10000
  const refund = Math.random() > 0.5 ? Math.floor(Math.random() * 500) + 50 : 0;
  const expenses = Math.floor(Math.random() * (income - 1000)) + 500;
  const savings = income - expenses + refund;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  return {
    income,
    expenses,
    savings,
    savingsRate,
    refund: refund > 0 ? refund : undefined,
  };
}

// Cache sample data for consistency during session
const dataCache = new Map<string, { income: number; expenses: number; savings: number; savingsRate: number; refund?: number }>();

function getCachedData(themeKey: string) {
  if (!dataCache.has(themeKey)) {
    dataCache.set(themeKey, generateSampleData());
  }
  return dataCache.get(themeKey)!;
}

export function DesignsPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <ThemeHeader />

      <div className="max-w-5xl mx-auto">
        {themeOrder.map((themeKey, index) => {
          const data = getCachedData(themeKey);
          const isVisible = loaded || index < 3; // Show first 3 immediately

          return (
            <div
              key={themeKey}
              className={`transition-all duration-700 ease-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <ThemeRow themeKey={themeKey as ThemeKey} data={data} />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-gray-400 text-sm">
        <p>Scroll to explore all design themes</p>
      </div>
    </div>
  );
}
