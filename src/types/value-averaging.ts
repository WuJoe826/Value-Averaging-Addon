export interface TickerAccountOption {
  id: string;
  name: string;
}

export interface PortfolioTicker {
  id: string;
  symbol: string;
  name: string;
  accountName: string;
  accountOptions: TickerAccountOption[];
  instrumentId: string | null;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  totalInvested: number;
  valueAveragingInvested: number;
}

export type GrowthInterval =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "half-yearly"
  | "yearly";

export type GrowthEndingMode = "specific-date" | "number-of-installments";

export interface GrowthSchedule {
  startDate: string;
  interval: GrowthInterval;
  endDateEnabled: boolean;
  endingMode: GrowthEndingMode;
  installments: number;
  endDate: string;
}

export interface ValueAveragingSettings {
  topUpMode: "amount" | "percentage";
  overflowGainsAction: "hold-to-next-round" | "sell";
  /**
   * When overflow gains use "hold-to-next-round", optional portfolio-wide minimum buy per cycle.
   * Each holding receives `overflowMinTopUpAmount * allocationFraction` (same weights as growth).
   */
  overflowMinTopUpAmount: number;
  purchaseUnit: "fractional-unit" | "whole-unit";
  topUpAmount: number;
  topUpPercentage: number;
  calculatedTopUpAmount: number;
  maxTopUpEnabled: boolean;
  /** Cap versus base plan; `null` means no limit when `maxTopUpEnabled` is on. */
  maxTopUpMultiplier: number | null;
  growthSchedule: GrowthSchedule;
  enabledTickers: Record<string, boolean>;
  tickerAllocations: Record<string, number>;
  tickerAccountSelection: Record<string, string>;
  tickerExecutedPeriods: Record<string, number>;
  initialDeploymentShares: Record<string, number>;
  initialDeploymentValue: Record<string, number>;
  isConfigured: boolean;
}
