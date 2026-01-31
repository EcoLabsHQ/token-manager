import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number with thousand separators (commas)
 * e.g., 1000000 -> "1,000,000"
 */
export function formatNumberWithCommas(value: string | number): string {
  // Remove any existing commas and non-numeric characters except decimal point
  const cleanValue = String(value).replace(/[^0-9.]/g, '');
  
  if (!cleanValue) return '';
  
  // Split by decimal point to handle decimals separately
  const parts = cleanValue.split('.');
  
  // Format the integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Join back with decimal if present
  return parts.join('.');
}

/**
 * Removes thousand separators (commas) from a formatted number string
 * e.g., "1,000,000" -> "1000000"
 */
export function parseFormattedNumber(value: string): string {
  return value.replace(/,/g, '');
}

/**
 * Formats a number for display with thousand separators
 * Uses toLocaleString for consistent formatting
 */
export function formatDisplayNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(parseFormattedNumber(value)) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US');
}
