import React, { useRef, useEffect, useCallback } from 'react';
import { Delete } from 'lucide-react';
import { haptic } from '../../lib/haptics';

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxDecimals?: number;
  maxAmount?: number;
  className?: string;
}

interface KeyConfig {
  digit: string;
  letters?: string;
}

const KEYS_1_TO_9: KeyConfig[] = [
  { digit: '1' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
];

export const Keypad: React.FC<KeypadProps> = ({
  value,
  onChange,
  maxDecimals = 2,
  maxAmount = 10_000_000,
  className = '',
}) => {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleDigit = useCallback(
    (digit: string) => {
      haptic.trigger('light');

      // If current value is empty or "0", typing "0" does nothing, other digit replaces "0"
      if (value === '0' || value === '') {
        if (digit === '0') return;
        onChange(digit);
        return;
      }

      // Check decimal places
      if (value.includes('.')) {
        const parts = value.split('.');
        if (parts[1] && parts[1].length >= maxDecimals) {
          return; // Don't allow beyond max decimals
        }
      }

      const nextVal = value + digit;
      const num = parseFloat(nextVal);
      if (!isNaN(num) && num > maxAmount) {
        return;
      }

      onChange(nextVal);
    },
    [value, onChange, maxDecimals, maxAmount]
  );

  const handleDecimal = useCallback(() => {
    haptic.trigger('selection');
    if (value.includes('.')) return;
    if (value === '') {
      onChange('0.');
    } else {
      onChange(value + '.');
    }
  }, [value, onChange]);

  const handleDelete = useCallback(() => {
    haptic.trigger('medium');
    if (value.length <= 1) {
      onChange('');
    } else {
      onChange(value.slice(0, -1));
    }
  }, [value, onChange]);

  const handleClear = useCallback(() => {
    haptic.trigger('heavy');
    onChange('');
  }, [onChange]);

  // Desktop physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        handleDecimal();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDecimal, handleDelete, handleClear]);

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      handleClear();
    }, 500);
  };

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const circleButtonClass =
    'keypad-btn flex flex-col items-center justify-center w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full aspect-square bg-surface hover:bg-surface-2 active:bg-surface-2/80 text-text border border-surface-2 dark:border-white/10 shadow-xs select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 transition-all duration-100';

  return (
    <div
      className={`grid grid-cols-3 justify-items-center gap-y-2.5 sm:gap-y-3.5 gap-x-5 sm:gap-x-8 max-w-[280px] sm:max-w-[310px] mx-auto w-full py-1 ${className}`}
    >
      {KEYS_1_TO_9.map(({ digit, letters }) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          className={circleButtonClass}
          aria-label={`Digit ${digit}`}
        >
          <span className="text-2xl sm:text-[26px] font-medium leading-none text-text">
            {digit}
          </span>
          {letters ? (
            <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-muted/70 uppercase leading-none mt-1">
              {letters}
            </span>
          ) : (
            <span className="text-[9px] sm:text-[10px] leading-none mt-1 opacity-0 pointer-events-none select-none">
              &nbsp;
            </span>
          )}
        </button>
      ))}

      {/* Decimal */}
      <button
        type="button"
        onClick={handleDecimal}
        className={circleButtonClass}
        aria-label="Decimal point"
      >
        <span className="text-2xl sm:text-[28px] font-bold leading-none text-text -mt-1">
          .
        </span>
      </button>

      {/* Zero */}
      <button
        type="button"
        onClick={() => handleDigit('0')}
        className={circleButtonClass}
        aria-label="Digit 0"
      >
        <span className="text-2xl sm:text-[26px] font-medium leading-none text-text">
          0
        </span>
        <span className="text-[10px] font-bold text-muted/70 leading-none mt-0.5">
          +
        </span>
      </button>

      {/* Backspace with long-press clear */}
      <button
        type="button"
        onClick={handleDelete}
        onMouseDown={startLongPress}
        onMouseUp={endLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        className={`${circleButtonClass} text-muted hover:text-danger active:text-danger`}
        aria-label="Backspace or hold to clear"
      >
        <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
    </div>
  );
};
