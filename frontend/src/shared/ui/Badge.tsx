import clsx from 'clsx';

interface BadgeProps {
  children: string;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  const style = color
    ? { backgroundColor: color, color: '#fff' }
    : undefined;
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
