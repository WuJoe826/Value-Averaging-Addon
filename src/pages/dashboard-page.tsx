import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { calculateInvestmentPlanByTicker, formatCurrency } from "../lib";
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
  periodIndex: number;
  growthPerPeriod: number;
  initialDeploymentValue: number;
  targetValue: number;
  currentPortfolioValue: number;
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
    () => calculateInvestmentPlanByTicker(settings, enabledTickers),
    [enabledTickers, settings],
  );
  const selectedTicker =
    enabledTickers.find((ticker) => ticker.id === selectedTickerId) ?? enabledTickers[0] ?? null;
  const selectedPlan = selectedTicker ? investmentPlan[selectedTicker.id] : null;

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
          <div className="space-y-2 lg:col-span-2 lg:flex lg:flex-col">
            <h2 className="text-sm font-medium">Holdings</h2>
            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="bg-muted-foreground/5 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Cost basis</TableHead>
                    <TableHead>Market value</TableHead>
                    <TableHead className="text-right">Desired Value</TableHead>
                    <TableHead className="text-right">Current / Desired</TableHead>
                    <TableHead className="text-right">Amount to invest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enabledTickers.map((ticker) => {
                    const plan = investmentPlan[ticker.id];
                    const quantity = toFiniteNumber(ticker.quantity);
                    const costBasis = toFiniteNumber(ticker.totalInvested);
                    const averageCost = quantity > 0 ? costBasis / quantity : toFiniteNumber(ticker.averageCost);
                    const currentPrice = toFiniteNumber(ticker.currentPrice);
                    const marketValue = currentPrice * quantity;
                    const currentDesiredDisplay = `${formatCurrency(
                      plan?.currentPortfolioValue ?? 0,
                      baseCurrency,
                    )} / ${formatCurrency(plan?.targetValue ?? 0, baseCurrency)}`;
                    const isSelected = selectedTicker?.id === ticker.id;

                    return (
                      <TableRow
                        key={ticker.id}
                        className={isSelected ? "bg-muted/50 cursor-pointer" : "cursor-pointer"}
                        onClick={() => setSelectedTickerId(ticker.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2 text-left">
                            <TickerLogo symbol={ticker.symbol} />
                            <div>
                              <div className="font-medium">{ticker.symbol}</div>
                              <div className="text-muted-foreground text-xs">{formatShareCount(quantity)} shares</div>
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
                          <div className="text-muted-foreground text-xs">{formatCurrency(currentPrice, baseCurrency)}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div>{formatCurrency(plan?.targetValue ?? 0, baseCurrency)}</div>
                          <div className="text-muted-foreground text-xs">
                            {formatCurrency(plan?.initialDeploymentValue ?? 0, baseCurrency)} +{" "}
                            {formatCurrency(plan?.growthPerPeriod ?? 0, baseCurrency)} x {plan?.periodIndex ?? 1}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{currentDesiredDisplay}</TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex flex-col items-end">
                            {plan?.action === "hold" ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                {baseCurrency} --.--
                              </Badge>
                            ) : plan && plan.amountToInvest < 0 ? (
                              <Badge variant="destructive">
                                {formatCurrency(Math.abs(plan.amountToInvest), baseCurrency)}
                              </Badge>
                            ) : (
                              <Badge variant="success">
                                {formatCurrency(plan?.amountToInvest ?? 0, baseCurrency)}
                              </Badge>
                            )}
                            <div className="text-muted-foreground mt-1 text-right text-xs leading-tight">
                              Shares:{" "}
                              {currentPrice > 0 && plan
                                ? formatShareCount(Math.abs(plan.amountToInvest) / currentPrice)
                                : "--.--"}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-2 lg:flex lg:flex-col">
            <h2 className="text-sm font-medium">Ticker details</h2>
            <Card className="lg:flex-1">
              <CardContent className="space-y-3 pt-4 text-sm">
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
                    <span className="text-muted-foreground">Desired value</span>
                    <span className="font-medium">{formatCurrency(selectedPlan.targetValue, baseCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current market value</span>
                    <span className="font-medium">{formatCurrency(selectedPlan.currentPortfolioValue, baseCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current / Desired</span>
                    <span className="font-medium">
                      {formatCurrency(selectedPlan.currentPortfolioValue, baseCurrency)} /{" "}
                      {formatCurrency(selectedPlan.targetValue, baseCurrency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount to invest</span>
                    {selectedPlan.action === "hold" ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        {baseCurrency} --.--
                      </Badge>
                    ) : selectedPlan.amountToInvest < 0 ? (
                      <Badge variant="destructive">
                        {formatCurrency(Math.abs(selectedPlan.amountToInvest), baseCurrency)}
                      </Badge>
                    ) : (
                      <Badge variant="success">{formatCurrency(selectedPlan.amountToInvest, baseCurrency)}</Badge>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Select a ticker to see details.</p>
              )}
              </CardContent>
            </Card>
          </div>
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
