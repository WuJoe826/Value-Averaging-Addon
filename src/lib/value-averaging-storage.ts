import {
  calculateEndDate,
  clampInstallments,
  getTodayIsoDate,
  isGrowthInterval,
  normalizeIsoDate,
} from "./growth-schedule";
import type { GrowthSchedule, PortfolioTicker, ValueAveragingSettings } from "../types";

const SETTINGS_STORAGE_KEY = "value-averaging-addon:settings";

export const DEFAULT_TICKERS: PortfolioTicker[] = [
  {
    id: "vti-main",
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    accountName: "Interactive Brokers",
    accountOptions: [{ id: "interactive-brokers", name: "Interactive Brokers" }],
    instrumentId: null,
    quantity: 49.149,
    averageCost: 244.15,
    currentPrice: 252.4,
    totalInvested: 12000,
    valueAveragingInvested: 8800,
  },
  {
    id: "vxus-longterm",
    symbol: "VXUS",
    name: "Vanguard Total International Stock ETF",
    accountName: "Fidelity",
    accountOptions: [{ id: "fidelity", name: "Fidelity" }],
    instrumentId: null,
    quantity: 109.76,
    averageCost: 59.22,
    currentPrice: 61.48,
    totalInvested: 6500,
    valueAveragingInvested: 5200,
  },
  {
    id: "bnd-income",
    symbol: "BND",
    name: "Vanguard Total Bond Market ETF",
    accountName: "Charles Schwab",
    accountOptions: [{ id: "charles-schwab", name: "Charles Schwab" }],
    instrumentId: null,
    quantity: 72.922,
    averageCost: 72.68,
    currentPrice: 71.91,
    totalInvested: 5300,
    valueAveragingInvested: 4300,
  },
];

export function buildDefaultSettings(): ValueAveragingSettings {
  const today = getTodayIsoDate();
  return {
    topUpMode: "amount",
    overflowGainsAction: "hold-to-next-round",
    purchaseUnit: "fractional-unit",
    topUpAmount: 500,
    topUpPercentage: 2,
    calculatedTopUpAmount: 500,
    maxTopUpEnabled: true,
    maxTopUpMultiplier: 10,
    growthSchedule: {
      startDate: today,
      interval: "monthly",
      endDateEnabled: false,
      endingMode: "number-of-installments",
      installments: 1,
      endDate: today,
    },
    enabledTickers: {},
    tickerAllocations: {},
    tickerAccountSelection: {},
    tickerExecutedPeriods: {},
    initialDeploymentShares: {},
    initialDeploymentValue: {},
    isConfigured: false,
  };
}

export function readSettings(): ValueAveragingSettings {
  const defaults = buildDefaultSettings();

  if (typeof window === "undefined") {
    return defaults;
  }

  const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!rawSettings) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(rawSettings) as Partial<ValueAveragingSettings> & {
      growthPeriodMonths?: number;
      growthSchedule?: Partial<GrowthSchedule>;
    };
    const legacyInstallments = clampInstallments(parsed.growthPeriodMonths ?? 1);
    const rawSchedule: Partial<GrowthSchedule> = parsed.growthSchedule ?? {};
    const startDate = normalizeIsoDate(rawSchedule.startDate ?? defaults.growthSchedule.startDate);
    const interval = rawSchedule.interval && isGrowthInterval(rawSchedule.interval) ? rawSchedule.interval : "monthly";
    const installments = clampInstallments(rawSchedule.installments ?? legacyInstallments);
    const endingMode =
      rawSchedule.endingMode === "specific-date" || rawSchedule.endingMode === "number-of-installments"
        ? rawSchedule.endingMode
        : defaults.growthSchedule.endingMode;
    const endDateEnabled = rawSchedule.endDateEnabled ?? defaults.growthSchedule.endDateEnabled;
    const endDate = calculateEndDate(startDate, interval, installments);
    const parsedMaxTopUpMultiplier = Number(parsed.maxTopUpMultiplier);
    const normalizedMaxTopUpMultiplier =
      parsed.maxTopUpMultiplier == null || !Number.isFinite(parsedMaxTopUpMultiplier)
        ? defaults.maxTopUpMultiplier
        : Math.min(100, Math.max(1, parsedMaxTopUpMultiplier));

    return {
      ...defaults,
      ...parsed,
      calculatedTopUpAmount:
        parsed.calculatedTopUpAmount == null || !Number.isFinite(parsed.calculatedTopUpAmount)
          ? defaults.calculatedTopUpAmount
          : Math.max(0, Number(parsed.calculatedTopUpAmount)),
      maxTopUpMultiplier: normalizedMaxTopUpMultiplier,
      overflowGainsAction:
        parsed.overflowGainsAction === "sell" || parsed.overflowGainsAction === "hold-to-next-round"
          ? parsed.overflowGainsAction
          : defaults.overflowGainsAction,
      purchaseUnit:
        parsed.purchaseUnit === "whole-unit" || parsed.purchaseUnit === "fractional-unit"
          ? parsed.purchaseUnit
          : defaults.purchaseUnit,
      growthSchedule: {
        startDate,
        interval,
        endDateEnabled,
        endingMode,
        installments,
        endDate,
      },
      enabledTickers: {
        ...defaults.enabledTickers,
        ...(parsed.enabledTickers ?? {}),
      },
      tickerAllocations: {
        ...defaults.tickerAllocations,
        ...(parsed.tickerAllocations ?? {}),
      },
      tickerAccountSelection: {
        ...defaults.tickerAccountSelection,
        ...(parsed.tickerAccountSelection ?? {}),
      },
      tickerExecutedPeriods: {
        ...defaults.tickerExecutedPeriods,
        ...(parsed.tickerExecutedPeriods ?? {}),
      },
      initialDeploymentShares: {
        ...defaults.initialDeploymentShares,
        ...(parsed.initialDeploymentShares ?? {}),
      },
      initialDeploymentValue: {
        ...defaults.initialDeploymentValue,
        ...(parsed.initialDeploymentValue ?? {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: ValueAveragingSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function clearSettings(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
}
