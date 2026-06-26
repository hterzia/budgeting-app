import { ReactNode } from 'react';
import clsx from 'clsx';

interface NeonCardProps {
  children: ReactNode;
  color?: 'cyan' | 'magenta' | 'yellow' | 'green';
  className?: string;
  glowIntensity?: 'low' | 'medium' | 'high';
  borderPattern?: 'solid' | 'dashed' | 'circuit';
}

const colorThemes = {
  cyan: {
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    hoverGlow: 'hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]',
    gradient: 'from-cyan-500/10 to-transparent',
  },
  magenta: {
    bg: 'bg-fuchsia-500/5',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-400',
    glow: 'shadow-[0_0_15px_rgba(217,70,239,0.15)]',
    hoverGlow: 'hover:shadow-[0_0_25px_rgba(217,70,239,0.3)]',
    gradient: 'from-fuchsia-500/10 to-transparent',
  },
  yellow: {
    bg: 'bg-yellow-500/5',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    glow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]',
    hoverGlow: 'hover:shadow-[0_0_25px_rgba(234,179,8,0.3)]',
    gradient: 'from-yellow-500/10 to-transparent',
  },
  green: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    hoverGlow: 'hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]',
    gradient: 'from-emerald-500/10 to-transparent',
  },
};

const borderPatterns = {
  solid: 'border border-opacity-40',
  dashed: 'border-dashed border border-opacity-50',
  circuit: 'border-[0.5px] border-dashed border-opacity-60',
};

export function NeonCard({
  children,
  color = 'cyan',
  className = '',
  glowIntensity = 'medium',
  borderPattern = 'circuit',
}: NeonCardProps) {
  const theme = colorThemes[color];
  const borderStyle = borderPatterns[borderPattern];

  const glowClasses = {
    low: theme.glow,
    medium: theme.glow.replace('15px', '20px'),
    high: theme.glow.replace('15px', '30px'),
  };

  return (
    <div
      className={clsx(
        'relative group overflow-hidden rounded-xl',
        theme.bg,
        theme.border,
        borderStyle,
        glowClasses[glowIntensity],
        theme.hoverGlow,
        'transition-all duration-300 ease-out',
        className
      )}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-current opacity-30 -mt-px -ml-px" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-current opacity-30 -mt-px -mr-px" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-current opacity-30 -mb-px -ml-px" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-current opacity-30 -mb-px -mr-px" />

      {/* Scanline effect on hover */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,3px_100%]" />

      <div className="relative z-10 p-4">{children}</div>
    </div>
  );
}
