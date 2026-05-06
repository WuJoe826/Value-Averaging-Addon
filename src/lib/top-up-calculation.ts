import type { PortfolioTicker, ValueAveragingSettings } from "../types";
import { getGrowthPeriodIndex } from "./growth-schedule";

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
}

function applyMaxTopUpIfNeeded(
  settings: ValueAveragingSettings,
  baseTopUpAmount: number,
  allocation: number,
  amountToInvest: number,
): number {
  if (amountToInvest <= 0) {
    return amountToInvest;
  }

  if (!settings.maxTopUpEnabled) {
    return amountToInvest;
  }

  const normalizedMultiplier = Math.max(1, toFiniteNumber(settings.maxTopUpMultiplier, 10));
  const maxAllowedTopUp = baseTopUpAmount * normalizedMultiplier * allocation;
  return Math.min(amountToInvest, maxAllowedTopUp);
}

export function calculateHoldingInvestmentPlan(
  ticker: PortfolioTicker,
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
): HoldingInvestmentPlan {
  const baseTopUpAmount = resolveBaseTopUpAmount(settings, enabledTickers);
  const basePeriodIndex = getGrowthPeriodIndex(settings.growthSchedule);
  const executedPeriods = Math.max(0, toFiniteNumber(settings.tickerExecutedPeriods[ticker.id], 0));
  const periodIndex = Math.max(1, basePeriodIndex + executedPeriods);
  const allocation = Math.max(0, toFiniteNumber(settings.tickerAllocations[ticker.id]) / 100);
  const growthPerPeriod = baseTopUpAmount * allocation;
  const initialDeploymentValue = Math.max(
    0,
    toFiniteNumber(settings.initialDeploymentValue[ticker.id], 0),
  );
  const targetValue = initialDeploymentValue + growthPerPeriod * periodIndex;
  const currentPortfolioValue = getTickerMarketValue(ticker);
  const rawAmountToInvest = targetValue - currentPortfolioValue;
  const overflowAmount = Math.max(0, currentPortfolioValue - targetValue);
  const hasOverflowBeyondTopUp = overflowAmount > growthPerPeriod;

  let amountToInvest = applyMaxTopUpIfNeeded(settings, baseTopUpAmount, allocation, rawAmountToInvest);
  let action: "buy" | "sell" | "hold" = amountToInvest < 0 ? "sell" : "buy";
  if (hasOverflowBeyondTopUp && settings.overflowGainsAction === "hold-to-next-round") {
    amountToInvest = 0;
    action = "hold";
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
  };
}

export function calculateInvestmentPlanByTicker(
  settings: ValueAveragingSettings,
  enabledTickers: PortfolioTicker[],
): Record<string, HoldingInvestmentPlan> {
  return enabledTickers.reduce<Record<string, HoldingInvestmentPlan>>((acc, ticker) => {
    acc[ticker.id] = calculateHoldingInvestmentPlan(ticker, settings, enabledTickers);
    return acc;
  }, {});
}
