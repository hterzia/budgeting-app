import clsx from 'clsx';

interface ThemeLabelProps {
  name: string;
  themeKey: string;
  className?: string;
}

// Theme label styles based on aesthetic
const themeLabelStyles: Record<string, string> = {
  brutallyMinimal: 'text-gray-900 text-sm tracking-wide uppercase font-medium',
  maximalistChaos: 'text-yellow-400 font-black italic text-xl',
  retroFuturistic: 'text-cyan-400 font-mono text-sm tracking-widest uppercase',
  organicNatural: 'text-emerald-900 font-serif text-base',
  luxuryRefined: 'text-gray-900 font-serif text-sm tracking-widest',
  playfulToyLike: 'text-rose-600 font-black text-lg',
  editorialMagazine: 'text-gray-900 font-serif text-lg italic',
  brutalistRaw: 'text-white font-bold text-sm uppercase',
  artDecoGeometric: 'text-amber-500 font-serif text-sm uppercase tracking-widest',
  softPastel: 'text-indigo-800 font-medium text-base',
  industrialUtilitarian: 'text-gray-100 font-mono text-xs uppercase',
  darkTheme: 'text-gray-100 font-semibold text-base',
};

export function ThemeLabel({ name, themeKey, className = '' }: ThemeLabelProps) {
  const style = themeLabelStyles[themeKey] || themeLabelStyles.brutallyMinimal;

  return (
    <span className={clsx(style, className)}>{name}</span>
  );
}

export function ThemeHeader() {
  return (
    <div className="mb-12 text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
        Design Showcase
      </h1>
      <p className="text-gray-600 max-w-2xl mx-auto">
        Preview 12 different card design themes. Scroll to see each theme's
        Income, Expenses, and Savings cards with sample data.
      </p>
    </div>
  );
}
