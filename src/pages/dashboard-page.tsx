import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DonutChart,
  EmptyPlaceholder,
  Icons,
  Page,
  PageContent,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wealthfolio/ui";
import React, { useMemo, useState } from "react";
import { PageTabSelector, type AddonPageTab } from "../components";
import { formatCurrency, getGrowthMonthsEquivalent, resolveBaseTopUpAmount } from "../lib";
import type { PortfolioTicker, ValueAveragingSettings } from "../types";

interface DashboardPageProps {
  ctx: AddonContext;
  baseCurrency: string;
  currentPage: AddonPageTab;
  onPageChange: (nextPage: AddonPageTab) => void;
  settings: ValueAveragingSettings;
  tickers: PortfolioTicker[];
  isTickersLoading: boolean;
  onFetchLatestPrices: () => void | Promise<void>;
  onAutoGenerateTransactions: () => void;
  generatedTransactions: string[];
}

interface InvestmentPlan {
  tickerId: string;
  targetValue: number;
  amountToInvest: number;
}

function formatShareCount(quantity: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(quantity);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function TickerLogo({ symbol }: { symbol: string }) {
  const fullSymbol = symbol.toUpperCase();
  const baseSymbol = fullSymbol.split(/[.:-]/)[0];
  const primaryLogoUrl = `/ticker-logos/${fullSymbol}.png`;
  const fallbackLogoUrl = `/ticker-logos/${baseSymbol}.png`;

  return (
    <Avatar className="bg-primary/80 border-white/20 h-7 w-7 shrink-0">
      <AvatarImage src={primaryLogoUrl} alt={fullSymbol} className="object-contain p-1.5" />
      <AvatarFallback>
        <Avatar className="bg-primary/80 border-white/20 text-white">
          <AvatarImage src={fallbackLogoUrl} alt={fullSymbol} className="object-contain p-1.5" />
          <AvatarFallback className="bg-transparent text-xs font-medium">
            <span className="p-1" title={fullSymbol}>
              {baseSymbol ? baseSymbol.slice(0, 4) : "•"}
            </span>
          </AvatarFallback>
        </Avatar>
      </AvatarFallback>
    </Avatar>
  );
}

function buildInvestmentPlan(
  tickers: PortfolioTicker[],
  settings: ValueAveragingSettings,
): Record<string, InvestmentPlan> {
  const baseTopUp = resolveBaseTopUpAmount(settings, tickers);

  const plans: Record<string, InvestmentPlan> = {};
  const growthMonths = getGrowthMonthsEquivalent(settings.growthSchedule);

  tickers.forEach((ticker) => {
    const allocation = (settings.tickerAllocations[ticker.id] ?? 0) / 100;
    const growthRatio = growthMonths / 120;
    const targetValue = ticker.totalInvested * (1 + growthRatio);
    const uncappedTopUp = baseTopUp * allocation;
    const maxAllowedTopUp =
      settings.maxTopUpEnabled && settings.maxTopUpMultiplier != null
        ? baseTopUp * settings.maxTopUpMultiplier * allocation
        : Number.MAX_SAFE_INTEGER;

    plans[ticker.id] = {
      tickerId: ticker.id,
      targetValue,
      amountToInvest: Math.max(0, Math.min(uncappedTopUp, maxAllowedTopUp)),
    };
  });

  return plans;
}

export default function DashboardPage({
  ctx,
  baseCurrency,
  currentPage,
  onPageChange,
  settings,
  tickers,
  isTickersLoading,
  onFetchLatestPrices,
  onAutoGenerateTransactions,
  generatedTransactions,
}: DashboardPageProps) {
  const [selectedTickerId, setSelectedTickerId] = useState<string | null>(null);

  const enabledTickers = useMemo(
    () => tickers.filter((ticker) => settings.enabledTickers[ticker.id]),
    [settings.enabledTickers, tickers],
  );

  const investmentPlan = useMemo(
    () => buildInvestmentPlan(enabledTickers, settings),
    [enabledTickers, settings],
  );

  const selectedTicker =
    enabledTickers.find((ticker) => ticker.id === selectedTickerId) ?? enabledTickers[0] ?? null;

  const selectedPlan = selectedTicker ? investmentPlan[selectedTicker.id] : null;
  const allocationData = useMemo(
    () =>
      enabledTickers.map((ticker) => ({
        tickerId: ticker.id,
        symbol: ticker.symbol,
        value: Math.max(0, toFiniteNumber(ticker.currentPrice) * toFiniteNumber(ticker.quantity)),
      })),
    [enabledTickers],
  );
  const totalAllocationValue = useMemo(
    () => allocationData.reduce((total, item) => total + item.value, 0),
    [allocationData],
  );
  const allocationChartData = useMemo(
    () => allocationData.map((item) => ({ name: item.symbol, value: item.value, currency: baseCurrency })),
    [allocationData, baseCurrency],
  );
  const selectedAllocationIndex = useMemo(() => {
    if (!allocationData.length) return 0;
    const selectedIndex = selectedTicker
      ? allocationData.findIndex((item) => item.tickerId === selectedTicker.id)
      : -1;
    return selectedIndex >= 0 ? selectedIndex : 0;
  }, [allocationData, selectedTicker]);

  const headerActions = <PageTabSelector currentPage={currentPage} onPageChange={onPageChange} />;

  if (isTickersLoading) {
    return (
      <Page>
        <PageHeader heading="Value Averaging" actions={headerActions} />
        <PageContent>
          <div className="text-muted-foreground py-12 text-center text-sm">Syncing portfolio holdings...</div>
        </PageContent>
      </Page>
    );
  }

  if (!tickers.length) {
    return (
      <Page>
        <PageHeader heading="Value Averaging" actions={headerActions} />
        <PageContent>
          <div className="flex justify-center">
            <div className="w-full max-w-lg">
              <EmptyPlaceholder className="mt-16">
                <EmptyPlaceholder.Icon name="PieChart" />
                <EmptyPlaceholder.Title>No portfolio yet</EmptyPlaceholder.Title>
                <EmptyPlaceholder.Description>
                  No holdings were found in your Wealthfolio portfolio. Add holdings first, then reopen this
                  page to build value averaging plans.
                </EmptyPlaceholder.Description>
                <Button
                  type="button"
                  onClick={() => {
                    void ctx.api.navigation.navigate("/holdings");
                  }}
                >
                  <Icons.PieChart className="mr-2 h-4 w-4" />
                  Go to holdings
                </Button>
              </EmptyPlaceholder>
            </div>
          </div>
        </PageContent>
      </Page>
    );
  }

  if (!enabledTickers.length) {
    return (
      <Page>
        <PageHeader heading="Value Averaging" actions={headerActions} />
        <PageContent>
          <div className="flex justify-center">
            <div className="w-full max-w-lg">
              <EmptyPlaceholder className="mt-16">
                <EmptyPlaceholder.Icon name="Activity2" />
                <EmptyPlaceholder.Title>Dashboard is empty</EmptyPlaceholder.Title>
                <EmptyPlaceholder.Description>
                  Enable at least one ticker in settings to build your value averaging portfolio.
                </EmptyPlaceholder.Description>
                <Button type="button" onClick={() => onPageChange("settings")}>
                  <Icons.Settings className="mr-2 h-4 w-4" />
                  Go to settings
                </Button>
              </EmptyPlaceholder>
            </div>
          </div>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader heading="Value Averaging" actions={headerActions} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Holdings</h2>
              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-muted-foreground/5 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Cost basis</TableHead>
                      <TableHead>Market value</TableHead>
                      <TableHead>Amount to invest</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enabledTickers.map((ticker) => {
                      const plan = investmentPlan[ticker.id];
                      const isSelected = selectedTicker?.id === ticker.id;
                      const quantity = toFiniteNumber(ticker.quantity);
                      const costBasis = toFiniteNumber(ticker.totalInvested);
                      const averageCost = quantity > 0 ? costBasis / quantity : toFiniteNumber(ticker.averageCost);
                      const currentPrice = toFiniteNumber(ticker.currentPrice);
                      const marketValue = currentPrice * quantity;

                      return (
                        <TableRow
                          key={ticker.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedTickerId(ticker.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedTickerId(ticker.id);
                            }
                          }}
                          className={isSelected ? "bg-muted/50 cursor-pointer" : "cursor-pointer"}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2 text-left">
                              <TickerLogo symbol={ticker.symbol} />
                              <div>
                                <div className="font-medium">{ticker.symbol}</div>
                                <div className="text-muted-foreground text-xs">
                                  {formatShareCount(quantity)} shares
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(costBasis, baseCurrency)}</div>
                            <div className="text-muted-foreground text-xs">
                              {formatCurrency(averageCost, baseCurrency)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(marketValue, baseCurrency)}</div>
                            <div className="text-muted-foreground text-xs">
                              {formatCurrency(currentPrice, baseCurrency)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(plan?.amountToInvest ?? 0, baseCurrency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Ticker details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selectedTicker && selectedPlan ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ticker</span>
                      <span className="font-medium">{selectedTicker.symbol}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Account</span>
                      <span className="font-medium">{selectedTicker.accountName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Shares</span>
                      <span className="font-medium">{formatShareCount(toFiniteNumber(selectedTicker.quantity))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cost basis</span>
                      <span className="font-medium">
                        {formatCurrency(toFiniteNumber(selectedTicker.totalInvested), baseCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total invested (VA)</span>
                      <span className="font-medium">
                        {formatCurrency(selectedTicker.valueAveragingInvested, baseCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Target portfolio value</span>
                      <span className="font-medium">{formatCurrency(selectedPlan.targetValue, baseCurrency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Amount to invest now</span>
                      <span className="font-medium">{formatCurrency(selectedPlan.amountToInvest, baseCurrency)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a ticker to see details.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Current allocation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalAllocationValue > 0 ? (
                <DonutChart
                  data={allocationChartData}
                  activeIndex={selectedAllocationIndex}
                  displayTooltip
                  onSectionClick={(_data, index) => {
                    const tickerId = allocationData[index]?.tickerId;
                    if (tickerId) {
                      setSelectedTickerId(tickerId);
                    }
                  }}
                />
              ) : (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Allocation chart unavailable because current market value is zero.
                </p>
              )}
              <div className="space-y-2">
                {allocationData.map((item) => {
                  const ratio = totalAllocationValue > 0 ? (item.value / totalAllocationValue) * 100 : 0;
                  return (
                    <div key={item.tickerId} className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedTickerId(item.tickerId)}
                        className="hover:text-foreground text-muted-foreground text-left transition-colors"
                      >
                        {item.symbol}
                      </button>
                      <span className="font-medium">{ratio.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generated transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {!generatedTransactions.length ? (
              <p className="text-muted-foreground text-sm">
                No auto-generated transaction yet. Click "Auto generate transaction" to create one.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {generatedTransactions.map((transaction) => (
                  <li key={transaction} className="bg-muted rounded-md px-3 py-2">
                    {transaction}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
