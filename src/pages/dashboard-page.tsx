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
import { calculateInvestmentPlanByTicker, formatCurrency } from "../lib";
import type { PortfolioTicker, ValueAveragingSettings } from "../types";
import { DashboardPageDesktop } from "./dashboard-page-desktop";
import { DashboardPageMobile } from "./dashboard-page-mobile";

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
  action: "buy" | "sell" | "hold";
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
  const [isTickerDetailSheetOpen, setIsTickerDetailSheetOpen] = useState(false);

  const enabledTickers = useMemo(
    () => tickers.filter((ticker) => settings.enabledTickers[ticker.id]),
    [settings.enabledTickers, tickers],
  );

  const investmentPlan = useMemo(
    () => calculateInvestmentPlanByTicker(settings, enabledTickers),
    [enabledTickers, settings],
  );
  const totalEnabledMarketValue = useMemo(
    () =>
      enabledTickers.reduce((total, ticker) => {
        const quantity = Number.isFinite(ticker.quantity) ? ticker.quantity : 0;
        const price = Number.isFinite(ticker.currentPrice) ? ticker.currentPrice : 0;
        return total + Math.max(0, quantity * price);
      }, 0),
    [enabledTickers],
  );
  const expectedWeightByTicker = useMemo(
    () =>
      enabledTickers.reduce<Record<string, number>>((acc, ticker) => {
        acc[ticker.id] = settings.tickerAllocations[ticker.id] ?? 0;
        return acc;
      }, {}),
    [enabledTickers, settings.tickerAllocations],
  );
  const actualWeightByTicker = useMemo(
    () =>
      enabledTickers.reduce<Record<string, number>>((acc, ticker) => {
        const quantity = Number.isFinite(ticker.quantity) ? ticker.quantity : 0;
        const price = Number.isFinite(ticker.currentPrice) ? ticker.currentPrice : 0;
        const marketValue = Math.max(0, quantity * price);
        acc[ticker.id] = totalEnabledMarketValue > 0 ? (marketValue / totalEnabledMarketValue) * 100 : 0;
        return acc;
      }, {}),
    [enabledTickers, totalEnabledMarketValue],
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
      <PageContent withPadding={false} containerMode>
        <div className="w-full min-w-0 space-y-3 px-3 pb-[calc(var(--mobile-nav-ui-height)+max(var(--mobile-nav-gap),env(safe-area-inset-bottom)))]">
          <DashboardPageDesktop
            baseCurrency={baseCurrency}
            enabledTickers={enabledTickers}
            investmentPlan={investmentPlan}
            expectedWeightByTicker={expectedWeightByTicker}
            actualWeightByTicker={actualWeightByTicker}
            selectedTickerId={selectedTickerId}
            onSelectTicker={setSelectedTickerId}
          />
          <DashboardPageMobile
            baseCurrency={baseCurrency}
            enabledTickers={enabledTickers}
            investmentPlan={investmentPlan}
            expectedWeightByTicker={expectedWeightByTicker}
            actualWeightByTicker={actualWeightByTicker}
            selectedTicker={selectedTicker}
            selectedPlan={selectedPlan}
            onSelectTicker={setSelectedTickerId}
            isTickerDetailSheetOpen={isTickerDetailSheetOpen}
            onTickerDetailSheetOpenChange={setIsTickerDetailSheetOpen}
          />
          <Card className="mb-5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Deploy Records</CardTitle>
              <Button
                type="button"
                size="sm"
                className="h-10 w-10 rounded-full p-0 sm:h-9 sm:w-auto sm:rounded-md sm:px-3"
                onClick={onAutoGenerateTransactions}
              >
                <span className="text-lg leading-none sm:hidden">+</span>
                <span className="hidden sm:inline">+ Auto generate transaction</span>
              </Button>
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
        </div>
      </PageContent>
    </Page>
  );
}
