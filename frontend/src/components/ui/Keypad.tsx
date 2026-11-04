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

  const buttonClass =
    'keypad-btn flex items-center justify-center h-13 sm:h-14 rounded-2xl bg-surface hover:bg-surface-2 text-text font-bold text-xl shadow-xs border border-surface-2 select-none focus:outline-none';

  return (
    <div className={`grid grid-cols-3 gap-2 sm:gap-2.5 px-1 max-w-sm mx-auto w-full ${className}`}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          className={buttonClass}
          aria-label={`Digit ${digit}`}
        >
          {digit}
        </button>
      ))}

      {/* Decimal */}
      <button
        type="button"
        onClick={handleDecimal}
        className={`${buttonClass} text-2xl pb-1`}
        aria-label="Decimal point"
      >
        .
      </button>

      {/* Zero */}
      <button
        type="button"
        onClick={() => handleDigit('0')}
        className={buttonClass}
        aria-label="Digit 0"
      >
        0
      </button>

      {/* Backspace with long-press clear */}
      <button
        type="button"
        onClick={handleDelete}
        onMouseDown={startLongPress}
        onMouseUp={endLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        className={`${buttonClass} text-muted hover:text-danger active:text-danger`}
        aria-label="Backspace or hold to clear"
      >
        <Delete className="w-5 h-5" />
      </button>
    </div>
  );
};
