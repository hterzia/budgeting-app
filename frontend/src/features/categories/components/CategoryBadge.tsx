interface CategoryBadgeProps {
  label: string;
  color: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function CategoryBadge({ label, color, onClick }: CategoryBadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer group transition-colors hover:ring-2 hover:ring-offset-1 hover:ring-gray-300"
      style={{ backgroundColor: color, color: "#fff" }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {label}
    </span>
  );
}
