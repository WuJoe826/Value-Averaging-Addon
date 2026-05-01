import type { GrowthInterval, GrowthSchedule } from "../types";

export const GROWTH_INTERVAL_OPTIONS: Array<{ value: GrowthInterval; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "BiMonthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getTodayIsoDate(): string {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function clampInstallments(value: number): number {
  const parsed = Math.floor(Number(value) || 1);
  return Math.max(1, parsed);
}

export function isGrowthInterval(value: string): value is GrowthInterval {
  return GROWTH_INTERVAL_OPTIONS.some((option) => option.value === value);
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeIsoDate(value: string | undefined): string {
  if (!value) {
    return getTodayIsoDate();
  }
  return parseIsoDate(value) ? value : getTodayIsoDate();
}

function formatDate(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function addIntervals(startDate: Date, interval: GrowthInterval, steps: number): Date {
  const result = new Date(startDate);
  switch (interval) {
    case "daily":
      result.setTime(result.getTime() + steps * MS_PER_DAY);
      return result;
    case "weekly":
      result.setTime(result.getTime() + steps * 7 * MS_PER_DAY);
      return result;
    case "biweekly":
      result.setTime(result.getTime() + steps * 14 * MS_PER_DAY);
      return result;
    case "monthly":
      result.setMonth(result.getMonth() + steps);
      return result;
    case "bimonthly":
      result.setMonth(result.getMonth() + steps * 2);
      return result;
    case "quarterly":
      result.setMonth(result.getMonth() + steps * 3);
      return result;
    case "half-yearly":
      result.setMonth(result.getMonth() + steps * 6);
      return result;
    case "yearly":
      result.setFullYear(result.getFullYear() + steps);
      return result;
    default:
      return result;
  }
}

export function calculateEndDate(startDate: string, interval: GrowthInterval, installments: number): string {
  const normalizedStart = normalizeIsoDate(startDate);
  const parsedStart = parseIsoDate(normalizedStart);
  if (!parsedStart) {
    return normalizedStart;
  }
  const steps = Math.max(0, clampInstallments(installments) - 1);
  return formatDate(addIntervals(parsedStart, interval, steps));
}

export function getIntervalMonths(interval: GrowthInterval): number {
  switch (interval) {
    case "daily":
      return 1 / 30;
    case "weekly":
      return 7 / 30;
    case "biweekly":
      return 14 / 30;
    case "monthly":
      return 1;
    case "bimonthly":
      return 2;
    case "quarterly":
      return 3;
    case "half-yearly":
      return 6;
    case "yearly":
      return 12;
    default:
      return 1;
  }
}

export function getGrowthMonthsEquivalent(schedule: GrowthSchedule): number {
  return Math.max(1 / 30, getIntervalMonths(schedule.interval) * clampInstallments(schedule.installments));
}
