import clsx from 'clsx';

// == Theme Definitions ==
const themes = {
  brutallyMinimal: {
    name: 'Brutally Minimal',
    bg: 'bg-white',
    cardBg: 'bg-white',
    border: 'border border-gray-200',
    titleColor: 'text-gray-900',
    labelColor: 'text-gray-500',
    textColor: 'text-gray-900',
    accentColor: 'text-gray-900',
    accentBg: 'bg-gray-900',
    shadow: 'shadow-none',
  },
  maximalistChaos: {
    name: 'Maximalist Chaos',
    bg: 'bg-gray-900',
    cardBg: 'bg-gray-800',
    border: 'border-4 border-double border-pink-500',
    titleColor: 'text-yellow-400 font-black italic',
    labelColor: 'text-cyan-300 font-bold tracking-wider',
    textColor: 'text-white font-bold',
    accentColor: 'text-fuchsia-400',
    accentBg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500',
    shadow: 'shadow-[0_0_30px_rgba(236,72,153,0.5)]',
  },
  retroFuturistic: {
    name: 'Retro-Futuristic',
    bg: 'bg-[#0a0f14]',
    cardBg: 'bg-cyan-500/10',
    border: 'border border-cyan-500/30',
    titleColor: 'text-cyan-400 font-mono',
    labelColor: 'text-cyan-300/60 text-xs font-mono',
    textColor: 'text-cyan-400 font-mono',
    accentColor: 'text-fuchsia-400',
    accentBg: 'bg-fuchsia-500/20',
    shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
  },
  organicNatural: {
    name: 'Organic/Natural',
    bg: 'bg-stone-50',
    cardBg: 'bg-emerald-500/5',
    border: 'border border-emerald-200/50 rounded-[2rem]',
    titleColor: 'text-emerald-900 font-serif',
    labelColor: 'text-emerald-600/70 text-sm',
    textColor: 'text-emerald-900 font-medium',
    accentColor: 'text-amber-600',
    accentBg: 'bg-amber-100',
    shadow: 'shadow-lg shadow-emerald-900/5',
  },
  luxuryRefined: {
    name: 'Luxury/Refined',
    bg: 'bg-gray-50',
    cardBg: 'bg-white',
    border: 'border border-gray-900/10',
    titleColor: 'text-gray-900 font-serif',
    labelColor: 'text-gray-500 text-sm tracking-widest',
    textColor: 'text-gray-900 font-medium',
    accentColor: 'text-amber-700',
    accentBg: 'bg-gray-900',
    shadow: 'shadow-xl shadow-gray-200',
  },
  playfulToyLike: {
    name: 'Playful/Toy-like',
    bg: 'bg-rose-50',
    cardBg: 'bg-white',
    border: 'border-4 border-rose-300',
    titleColor: 'text-rose-600 font-black',
    labelColor: 'text-rose-400 font-bold text-sm',
    textColor: 'text-rose-600 font-bold',
    accentColor: 'text-purple-500',
    accentBg: 'bg-purple-500',
    shadow: 'shadow-[0_8px_0_#fda4af] active:shadow-none active:translate-y-2',
  },
  editorialMagazine: {
    name: 'Editorial/Magazine',
    bg: 'bg-[#f9fafb]',
    cardBg: 'bg-white',
    border: 'border border-gray-300',
    titleColor: 'text-gray-900 font-serif text-3xl',
    labelColor: 'text-gray-600 font-serif italic text-sm',
    textColor: 'text-gray-900 font-serif text-4xl',
    accentColor: 'text-red-700',
    accentBg: 'bg-red-100',
    shadow: 'shadow-md',
  },
  brutalistRaw: {
    name: 'Brutalist/Raw',
    bg: 'bg-gray-100',
    cardBg: 'bg-gray-800',
    border: 'border-2 border-black',
    titleColor: 'text-white font-bold text-2xl uppercase',
    labelColor: 'text-gray-300 font-mono text-xs uppercase',
    textColor: 'text-white font-bold text-3xl',
    accentColor: 'text-yellow-400',
    accentBg: 'bg-black',
    shadow: 'shadow-none',
  },
  artDecoGeometric: {
    name: 'Art Deco/Geometric',
    bg: 'bg-[#1a1816]',
    cardBg: 'bg-amber-900/20',
    border: 'border-t-4 border-b-4 border-amber-600/50',
    titleColor: 'text-amber-500 font-serif uppercase',
    labelColor: 'text-amber-400/60 text-xs uppercase tracking-widest',
    textColor: 'text-amber-100 font-serif',
    accentColor: 'text-purple-400',
    accentBg: 'bg-purple-900/30',
    shadow: 'shadow-[4px_4px_0_rgba(245,158,11,0.3)]',
  },
  softPastel: {
    name: 'Soft/Pastel',
    bg: 'bg-indigo-50/50',
    cardBg: 'bg-white/80',
    border: 'border border-indigo-100 rounded-full',
    titleColor: 'text-indigo-800 font-medium',
    labelColor: 'text-indigo-400 text-xs',
    textColor: 'text-indigo-600 font-bold',
    accentColor: 'text-pink-500',
    accentBg: 'bg-pink-100',
    shadow: 'shadow-lg shadow-indigo-200/50',
  },
  industrialUtilitarian: {
    name: 'Industrial/Utilitarian',
    bg: 'bg-[#1c1917]',
    cardBg: 'bg-gray-800',
    border: 'border-l-4 border-gray-600',
    titleColor: 'text-gray-100 font-mono text-lg uppercase',
    labelColor: 'text-gray-400 font-mono text-xs uppercase',
    textColor: 'text-gray-100 font-mono text-2xl',
    accentColor: 'text-orange-500',
    accentBg: 'bg-gray-700',
    shadow: 'shadow-none',
  },
  darkTheme: {
    name: 'Dark Theme',
    bg: 'bg-gray-950',
    cardBg: 'bg-gray-900',
    border: 'border border-gray-800',
    titleColor: 'text-gray-100 font-semibold',
    labelColor: 'text-gray-500 text-sm',
    textColor: 'text-gray-100 font-bold text-3xl',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-900/30',
    shadow: 'shadow-2xl shadow-black/50',
  },
};

// == Card Types ==
const cardTypes = ['Income', 'Expenses', 'Savings'] as const;
type CardType = typeof cardTypes[number];

interface ThemeCardProps {
  themeKey: string;
  cardType: CardType;
  amount: number;
  subtext?: string;
}

export function ThemeCard({ themeKey, cardType, amount, subtext }: ThemeCardProps) {
  const theme = themes[themeKey as keyof typeof themes];
  if (!theme) return null;

  const cardColors = {
    Income: theme.accentBg,
    Expenses: theme.accentBg,
    Savings: theme.accentBg,
  };

  const cardColor = cardColors[cardType];

  return (
    <div
      className={clsx(
        'p-6 rounded-lg transition-all duration-300',
        theme.cardBg,
        theme.border,
        theme.shadow,
        cardColor
      )}
    >
      <p className={clsx('text-sm mb-2', theme.labelColor)}>{cardType}</p>
      <p className={clsx('text-3xl font-bold', theme.textColor)}>
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount)}
      </p>
      {subtext && <p className={clsx('mt-1 text-xs', theme.labelColor)}>{subtext}</p>}
    </div>
  );
}

interface ThemeRowProps {
  themeKey: string;
  data: {
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
    refund?: number;
  };
}

export function ThemeRow({ themeKey, data }: ThemeRowProps) {
  const theme = themes[themeKey as keyof typeof themes];
  if (!theme) return null;

  const refundSubtext =
    data.refund && data.refund > 0
      ? `(${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.refund)} in refunds)`
      : undefined;

  return (
    <div className="flex flex-col md:flex-row gap-6 mb-12 items-start md:items-center animate-fade-in-up">
      {/* Theme Label */}
      <div className="flex-shrink-0 w-full md:w-48">
        <h3 className={clsx('text-lg font-semibold', theme.titleColor)}>{theme.name}</h3>
      </div>

      {/* Cards */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <ThemeCard
          themeKey={themeKey}
          cardType="Income"
          amount={data.income}
        />
        <ThemeCard
          themeKey={themeKey}
          cardType="Expenses"
          amount={data.expenses}
          subtext={refundSubtext}
        />
        <ThemeCard
          themeKey={themeKey}
          cardType="Savings"
          amount={data.savings}
          subtext={`${data.savingsRate.toFixed(1)}% rate`}
        />
      </div>
    </div>
  );
}

interface DesignPreviewProps {
  themeKey: string;
  data: {
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
    refund?: number;
  };
}

export function DesignPreview({ themeKey, data }: DesignPreviewProps) {
  return <ThemeRow themeKey={themeKey} data={data} />;
}
