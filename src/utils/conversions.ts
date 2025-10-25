import type { UnitSystem } from '../types';

export const POUNDS_PER_KILOGRAM = 2.20462;
export const INCHES_PER_METER = 39.3701;

export function kilogramsToPounds(kg: number): number {
  return kg * POUNDS_PER_KILOGRAM;
}

export function poundsToKilograms(lb: number): number {
  return lb / POUNDS_PER_KILOGRAM;
}

export function centimetersToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return { feet, inches };
}

export function feetInchesToCentimeters(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

export function metersToCentimeters(meters: number): number {
  return meters * 100;
}

export function formatWeight(weightKg: number, unit: UnitSystem, fractionDigits = 1): string {
  if (unit === 'imperial') {
    return `${kilogramsToPounds(weightKg).toFixed(fractionDigits)} lb`;
  }
  return `${weightKg.toFixed(fractionDigits)} kg`;
}

export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function centimetersToMeters(cm: number): number {
  return cm / 100;
}

export function metersSquared(heightCm: number): number {
  const meters = centimetersToMeters(heightCm);
  return meters * meters;
}
