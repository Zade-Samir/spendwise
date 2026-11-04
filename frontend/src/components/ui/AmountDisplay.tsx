import React from 'react';

interface AmountDisplayProps {
  value: string;
  currency?: string;
  className?: string;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  value,
  currency = '₹',
  className = '',
}) => {
  const displayVal = value.length > 0 ? value : '0';

  return (
    <div className={`flex items-baseline justify-center select-none py-3 ${className}`}>
      <span className="text-3xl font-semibold text-primary mr-1.5 self-center">
        {currency}
      </span>
      <span className="text-5xl font-extrabold tracking-tight tabular-nums text-text">
        {displayVal}
      </span>
      <span className="inline-block w-0.5 h-10 bg-primary ml-1 animate-pulse rounded-full self-center" />
    </div>
  );
};
