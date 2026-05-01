export interface PortfolioTicker {
  id: string;
  symbol: string;
  name: string;
  accountName: string;
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
  topUpAmount: number;
  topUpPercentage: number;
  maxTopUpEnabled: boolean;
  /** Cap versus base plan; `null` means no limit when `maxTopUpEnabled` is on. */
  maxTopUpMultiplier: number | null;
  growthSchedule: GrowthSchedule;
  enabledTickers: Record<string, boolean>;
  tickerAllocations: Record<string, number>;
  isConfigured: boolean;
}
