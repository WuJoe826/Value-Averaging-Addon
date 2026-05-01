import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
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
} from "@wealthfolio/ui";
import React, { useMemo, useState } from "react";
import { PageTabSelector, type AddonPageTab } from "../components";
import { formatCurrency } from "../lib";
import type { PortfolioTicker, ValueAveragingSettings } from "../types";

interface DashboardPageProps {
  ctx: AddonContext;
  baseCurrency: string;
  currentPage: AddonPageTab;
  onPageChange: (nextPage: AddonPageTab) => void;
  settings: ValueAveragingSettings;
  tickers: PortfolioTicker[];
  onFetchLatestPrices: () => void;
  onAutoGenerateTransactions: () => void;
  generatedTransactions: string[];
}

interface InvestmentPlan {
  tickerId: string;
  targetValue: number;
  amountToInvest: number;
}

function buildInvestmentPlan(
  tickers: PortfolioTicker[],
  settings: ValueAveragingSettings,
): Record<string, InvestmentPlan> {
  const baseTopUp =
    settings.topUpMode === "amount"
      ? settings.topUpAmount
      : (tickers.reduce((total, ticker) => total + ticker.currentPrice, 0) * settings.topUpPercentage) /
        100;

  const plans: Record<string, InvestmentPlan> = {};

  tickers.forEach((ticker) => {
    const allocation = (settings.tickerAllocations[ticker.id] ?? 0) / 100;
    const growthRatio = settings.growthPeriodMonths / 120;
    const targetValue = ticker.totalInvested * (1 + growthRatio);
    const valueGap = Math.max(0, targetValue - ticker.currentPrice);

    const uncappedTopUp = baseTopUp * allocation + valueGap * 0.2;
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

  const headerActions = <PageTabSelector currentPage={currentPage} onPageChange={onPageChange} />;

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
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tickers / Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left">
                      <th className="px-2 py-2 font-medium">Ticker</th>
                      <th className="px-2 py-2 font-medium">Cost basis</th>
                      <th className="px-2 py-2 font-medium">Market value</th>
                      <th className="px-2 py-2 font-medium">Amount to invest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enabledTickers.map((ticker) => {
                      const plan = investmentPlan[ticker.id];
                      const isSelected = selectedTicker?.id === ticker.id;

                      return (
                        <tr
                          key={ticker.id}
                          className={`border-b last:border-b-0 ${isSelected ? "bg-muted/50" : ""}`}
                        >
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedTickerId(ticker.id)}
                              className="text-left"
                            >
                              <div className="font-medium">{ticker.symbol}</div>
                              <div className="text-muted-foreground text-xs">{ticker.name}</div>
                            </button>
                          </td>
                          <td className="px-2 py-3">
                            <div className="font-medium">{formatCurrency(ticker.averageCost, baseCurrency)}</div>
                            <div className="text-muted-foreground text-xs">Avg price</div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="font-medium">{formatCurrency(ticker.currentPrice, baseCurrency)}</div>
                            <div className="text-muted-foreground text-xs">Current price</div>
                          </td>
                          <td className="px-2 py-3 font-medium">
                            {formatCurrency(plan?.amountToInvest ?? 0, baseCurrency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

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
