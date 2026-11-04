import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Keypad } from './Keypad';

describe('Keypad component', () => {
  it('renders all numeric keys 0-9, decimal, and backspace', () => {
    const onChange = vi.fn();
    render(<Keypad value="" onChange={onChange} />);

    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: `Digit ${i}` })).toBeDefined();
    }
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Backspace or hold to clear' })).toBeDefined();
  });

  it('calls onChange with clicked digit', () => {
    const onChange = vi.fn();
    render(<Keypad value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Digit 5' }));
    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('prevents multiple decimals', () => {
    const onChange = vi.fn();
    render(<Keypad value="150." onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Decimal point' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects 2-decimal restriction', () => {
    const onChange = vi.fn();
    render(<Keypad value="150.50" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Digit 9' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('handles backspace correctly', () => {
    const onChange = vi.fn();
    render(<Keypad value="150" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Backspace or hold to clear' }));
    expect(onChange).toHaveBeenCalledWith('15');
  });
});
