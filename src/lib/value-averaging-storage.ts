import type { PortfolioTicker, ValueAveragingSettings } from "../types";

const SETTINGS_STORAGE_KEY = "value-averaging-addon:settings";

export const DEFAULT_TICKERS: PortfolioTicker[] = [
  {
    id: "vti-main",
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    accountName: "Interactive Brokers",
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
    averageCost: 72.68,
    currentPrice: 71.91,
    totalInvested: 5300,
    valueAveragingInvested: 4300,
  },
];

export function buildDefaultSettings(): ValueAveragingSettings {
  return {
    topUpMode: "amount",
    topUpAmount: 500,
    topUpPercentage: 2,
    maxTopUpEnabled: true,
    maxTopUpMultiplier: 3,
    growthPeriodMonths: 12,
    enabledTickers: {},
    tickerAllocations: {},
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
    const parsed = JSON.parse(rawSettings) as Partial<ValueAveragingSettings>;

    return {
      ...defaults,
      ...parsed,
      enabledTickers: {
        ...defaults.enabledTickers,
        ...(parsed.enabledTickers ?? {}),
      },
      tickerAllocations: {
        ...defaults.tickerAllocations,
        ...(parsed.tickerAllocations ?? {}),
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
