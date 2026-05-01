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

export interface ValueAveragingSettings {
  topUpMode: "amount" | "percentage";
  topUpAmount: number;
  topUpPercentage: number;
  maxTopUpEnabled: boolean;
  /** Cap versus base plan; `null` means no limit when `maxTopUpEnabled` is on. */
  maxTopUpMultiplier: number | null;
  growthPeriodMonths: number;
  enabledTickers: Record<string, boolean>;
  tickerAllocations: Record<string, number>;
  isConfigured: boolean;
}
