import clsx from 'clsx';

export function Spinner({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={clsx('animate-spin rounded-full border-2 border-b-transparent border-blue-600', className)}
      style={{ width: size, height: size }}
    />
  );
}
