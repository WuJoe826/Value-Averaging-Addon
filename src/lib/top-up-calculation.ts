import type { PortfolioTicker, ValueAveragingSettings } from "../types";

const ALLOCATION_MIN = 99.9;
const ALLOCATION_MAX = 100;

function toFiniteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getTickerMarketValue(ticker: PortfolioTicker): number {
  const quantity = Math.max(0, toFiniteNumber(ticker.quantity));
  const currentPrice = Math.max(0, toFiniteNumber(ticker.currentPrice));
  return quantity * currentPrice;
}

export function getEnabledAllocationTotal(
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
): number {
  return enabledTickers.reduce((total, ticker) => total + (settings.tickerAllocations[ticker.id] ?? 0), 0);
}

export function getEnabledPortfolioWorth(enabledTickers: PortfolioTicker[]): number {
  return enabledTickers.reduce((total, ticker) => total + getTickerMarketValue(ticker), 0);
}

export function canCalculatePercentageTopUp(
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
): boolean {
  if (!enabledTickers.length) {
    return false;
  }

  const allocationTotal = getEnabledAllocationTotal(settings, enabledTickers);
  const isAllocationValid = allocationTotal >= ALLOCATION_MIN && allocationTotal <= ALLOCATION_MAX;
  if (!isAllocationValid) {
    return false;
  }

  const enabledPortfolioWorth = getEnabledPortfolioWorth(enabledTickers);
  return enabledPortfolioWorth > 0;
}

export function calculatePercentageTopUpAmount(
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
): number {
  const enabledPortfolioWorth = getEnabledPortfolioWorth(enabledTickers);
  return Math.max(0, (enabledPortfolioWorth * settings.topUpPercentage) / 100);
}

export function resolveBaseTopUpAmount(
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
): number {
  if (settings.topUpMode === "amount") {
    return Math.max(0, toFiniteNumber(settings.topUpAmount));
  }

  if (canCalculatePercentageTopUp(settings, enabledTickers)) {
    return calculatePercentageTopUpAmount(settings, enabledTickers);
  }

  return Math.max(0, toFiniteNumber(settings.calculatedTopUpAmount));
}
