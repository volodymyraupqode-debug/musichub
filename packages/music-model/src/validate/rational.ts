import { PPQ } from '../constants.js';
import type { Duration, TimeSignature } from '../schema/document.js';

/** Exact non-negative rational number, always reduced. Used so tuplets and dots never round. */
export type Rational = { readonly numerator: number; readonly denominator: number };

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function rational(numerator: number, denominator = 1): Rational {
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export const ZERO: Rational = rational(0);

export function add(a: Rational, b: Rational): Rational {
  return rational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function compare(a: Rational, b: Rational): number {
  return a.numerator * b.denominator - b.numerator * a.denominator;
}

/** Duration of a beat in ticks (PPQ 960), including dots and tuplet ratio. */
export function durationTicks(duration: Duration): Rational {
  // Dotted value = base × (2 − 1/2^dots).
  const dotFactor = rational(2 ** (duration.dots + 1) - 1, 2 ** duration.dots);
  const tupletNormal = duration.tuplet?.normal ?? 1;
  const tupletActual = duration.tuplet?.actual ?? 1;
  return rational(
    PPQ * 4 * dotFactor.numerator * tupletNormal,
    duration.value * dotFactor.denominator * tupletActual,
  );
}

/** Length of a bar in ticks for a time signature. */
export function barTicks(timeSignature: TimeSignature): Rational {
  return rational(PPQ * 4 * timeSignature.numerator, timeSignature.denominator);
}
