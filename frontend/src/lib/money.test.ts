import { describe, it, expect } from 'vitest';
import { parseRupeesToMinor, formatINR, formatINRCompact } from './money';

describe('money.ts financial utilities', () => {
  describe('parseRupeesToMinor', () => {
    it('parses whole rupee amounts correctly into integer paise', () => {
      expect(parseRupeesToMinor('150')).toBe(15000);
      expect(parseRupeesToMinor('0')).toBe(0);
      expect(parseRupeesToMinor('1')).toBe(100);
    });

    it('parses fractional rupee amounts with 1 or 2 decimals', () => {
      expect(parseRupeesToMinor('150.5')).toBe(15050);
      expect(parseRupeesToMinor('150.05')).toBe(15005);
      expect(parseRupeesToMinor('150.99')).toBe(15099);
      expect(parseRupeesToMinor('.50')).toBe(50);
    });

    it('handles commas and formatting characters gracefully', () => {
      expect(parseRupeesToMinor('₹1,500.50')).toBe(150050);
      expect(parseRupeesToMinor(' 2,50,000 ')).toBe(25000000);
    });

    it('caps at maximum 10 crore paise', () => {
      expect(parseRupeesToMinor('9999999999')).toBe(1000000000);
    });

    it('handles empty or invalid string inputs safely', () => {
      expect(parseRupeesToMinor('')).toBe(0);
      expect(parseRupeesToMinor('abc')).toBe(0);
    });
  });

  describe('formatINR', () => {
    it('formats whole amounts without paise decimals by default', () => {
      const formatted = formatINR(15000);
      // Standard en-IN currency format contains ₹ and 150
      expect(formatted).toContain('150');
      expect(formatted).toContain('₹');
    });

    it('formats fractional paise amounts with 2 decimals', () => {
      const formatted = formatINR(15050);
      expect(formatted).toContain('150.50');
    });

    it('respects showPaise override option', () => {
      const formatted = formatINR(15000, { showPaise: true });
      expect(formatted).toContain('150.00');
    });
  });

  describe('formatINRCompact', () => {
    it('formats lakhs and crores compactly', () => {
      expect(formatINRCompact(15000000)).toContain('1.5 L');
      expect(formatINRCompact(1000000000)).toContain('1 Cr');
      expect(formatINRCompact(2500000)).toContain('25 K');
    });
  });
});
