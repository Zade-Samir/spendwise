import React from 'react';
import { haptic } from '../../lib/haptics';

interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  selected?: boolean;
  color?: string; // Hex color for category accent
  badge?: string | number;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  selected = false,
  color,
  badge,
  onClick,
  className = '',
  size = 'md',
}) => {
  const isSm = size === 'sm';

  const handleClick = () => {
    haptic.trigger('selection');
    onClick?.();
  };

  const baseClasses = `ios-press inline-flex items-center justify-center font-medium rounded-full select-none cursor-pointer whitespace-nowrap min-h-[36px] ${
    isSm ? 'px-3 py-1 text-xs gap-1.5' : 'px-3.5 py-2 text-xs font-semibold gap-2'
  }`;

  // Custom inline styling when a color accent is provided
  const customStyle: React.CSSProperties = {};
  if (selected && color) {
    customStyle.backgroundColor = color;
    customStyle.color = '#FFFFFF';
    customStyle.borderColor = color;
  } else if (!selected && color) {
    customStyle.borderColor = `${color}40`; // 25% opacity border
  }

  const stateClasses = selected
    ? color
      ? 'shadow-xs text-white'
      : 'bg-primary text-white border-primary shadow-xs'
    : 'bg-surface hover:bg-surface-2 text-text border border-surface-2';

  return (
    <button
      type="button"
      onClick={handleClick}
      style={customStyle}
      className={`${baseClasses} ${stateClasses} ${className}`}
    >
      {icon && (
        <span
          className="flex-shrink-0 flex items-center justify-center"
          style={{ color: selected ? '#FFFFFF' : color || 'inherit' }}
        >
          {icon}
        </span>
      )}
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            selected ? 'bg-white/20 text-white' : 'bg-surface-2 text-muted'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
};
