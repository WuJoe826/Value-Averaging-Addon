import type { PortfolioTicker, ValueAveragingSettings } from "../types";

const ALLOCATION_MIN = 99.9;
const ALLOCATION_MAX = 100;

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  return isAllocationValid;
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

export function getEffectiveGrowthPeriodIndex(
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
): number {
  if (!enabledTickers.length) {
    return 1;
  }

  const minExecutedPeriod = enabledTickers.reduce((min, ticker) => {
    const executedPeriod = Math.max(0, Number(settings.tickerExecutedPeriods[ticker.id] ?? 0));
    return Math.min(min, executedPeriod);
  }, Number.POSITIVE_INFINITY);

  const nextPeriod = Number.isFinite(minExecutedPeriod) ? minExecutedPeriod + 1 : 1;
  return Math.max(1, nextPeriod);
}

interface HoldingInvestmentPlan {
  tickerId: string;
  periodIndex: number;
  growthPerPeriod: number;
  initialDeploymentValue: number;
  targetValue: number;
  currentPortfolioValue: number;
  amountToInvest: number;
  action: "buy" | "sell" | "hold";
  hasOverflowBeyondTopUp: boolean;
  /** True when gains are held (no sell) due to overflow + "hold to next round". */
  overflowHoldDeferred: boolean;
}

function applyMaxTopUpIfNeeded(
  settings: ValueAveragingSettings,
  baseTopUpAmount: number,
  allocationFraction: number,
  amountToInvest: number,
): number {
  if (amountToInvest <= 0) {
    return amountToInvest;
  }

  if (!settings.maxTopUpEnabled) {
    return amountToInvest;
  }

  const normalizedMultiplier = Math.max(1, toFiniteNumber(settings.maxTopUpMultiplier, 10));
  const maxAllowedTopUp = baseTopUpAmount * normalizedMultiplier * allocationFraction;
  return Math.min(amountToInvest, maxAllowedTopUp);
}

export function calculateHoldingInvestmentPlan(
  ticker: PortfolioTicker,
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
  periodIndexOverride?: number,
): HoldingInvestmentPlan {
  const baseTopUpAmount = resolveBaseTopUpAmount(settings, enabledTickers);
  const rawPeriodIndex = Number(periodIndexOverride);
  const periodIndex = Number.isFinite(rawPeriodIndex) && rawPeriodIndex > 0
    ? rawPeriodIndex
    : getEffectiveGrowthPeriodIndex(settings, enabledTickers);
  const enabledAllocationSum = getEnabledAllocationTotal(settings, enabledTickers);
  const tickerAllocationPct = Math.max(0, toFiniteNumber(settings.tickerAllocations[ticker.id]));
  const allocationFraction =
    enabledAllocationSum > 0 ? tickerAllocationPct / enabledAllocationSum : 0;
  const growthPerPeriod = baseTopUpAmount * allocationFraction;
  const initialDeploymentValue = Math.max(
    0,
    toFiniteNumber(settings.initialDeploymentValue[ticker.id], 0),
  );
  const targetValue = initialDeploymentValue + growthPerPeriod * periodIndex;
  const currentPortfolioValue = getTickerMarketValue(ticker);
  const rawAmountToInvest = targetValue - currentPortfolioValue;
  const overflowAmount = Math.max(0, currentPortfolioValue - targetValue);
  const hasOverflowBeyondTopUp = overflowAmount > growthPerPeriod;

  let amountToInvest = applyMaxTopUpIfNeeded(settings, baseTopUpAmount, allocationFraction, rawAmountToInvest);
  let action: "buy" | "sell" | "hold" = amountToInvest < 0 ? "sell" : "buy";
  let overflowHoldDeferred = false;
  if (hasOverflowBeyondTopUp && settings.overflowGainsAction === "hold-to-next-round") {
    amountToInvest = 0;
    action = "hold";
    overflowHoldDeferred = true;
  }

  return {
    tickerId: ticker.id,
    periodIndex,
    growthPerPeriod,
    initialDeploymentValue,
    targetValue,
    currentPortfolioValue,
    amountToInvest,
    action,
    hasOverflowBeyondTopUp,
    overflowHoldDeferred,
  };
}

export function calculateInvestmentPlanByTicker(
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
  periodIndexOverride?: number,
): Record<string, HoldingInvestmentPlan> {
  return enabledTickers.reduce<Record<string, HoldingInvestmentPlan>>((acc, ticker) => {
    acc[ticker.id] = calculateHoldingInvestmentPlan(ticker, settings, enabledTickers, periodIndexOverride);
    return acc;
  }, {});
}
