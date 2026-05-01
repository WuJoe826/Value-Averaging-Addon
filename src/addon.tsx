import { QueryClientProvider, type QueryClient, useQuery } from "@tanstack/react-query";
import type { Account, AddonContext, AddonEnableFunction, Holding } from "@wealthfolio/addon-sdk";
import { Icons } from "@wealthfolio/ui";
import React, { useEffect, useMemo, useState } from "react";
import type { AddonPageTab } from "./components/page-tab-selector";
import { formatCurrency, readSettings, saveSettings } from "./lib";
import { DashboardPage, SettingsPage } from "./pages";
import type { PortfolioTicker, ValueAveragingSettings } from "./types";

interface RawTickerSnapshot {
  key: string;
  symbol: string;
  name: string;
  accountName: string;
  quantity: number;
  marketValue: number;
  totalInvested: number;
  currentPrice: number;
}

function mapHoldingToSnapshot(account: Account, holding: Holding): RawTickerSnapshot {
  const symbol = holding.instrument?.symbol ?? holding.id;
  const name = holding.instrument?.name ?? symbol;
  const quantity = Number(holding.quantity) || 0;
  const marketValue = Number(holding.marketValue?.local ?? holding.marketValue?.base ?? 0);
  const totalInvested = Number(holding.costBasis?.local ?? holding.costBasis?.base ?? 0);
  const currentPrice = Number(holding.price ?? (quantity > 0 ? marketValue / quantity : 0));

  return {
    key: `${symbol.toLowerCase()}::${name.toLowerCase()}`,
    symbol,
    name,
    accountName: account.name,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    marketValue: Number.isFinite(marketValue) ? marketValue : 0,
    totalInvested: Number.isFinite(totalInvested) ? totalInvested : 0,
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
  };
}

function aggregateTickers(snapshots: RawTickerSnapshot[]): PortfolioTicker[] {
  const grouped = new Map<
    string,
    {
      symbol: string;
      name: string;
      accountNames: Set<string>;
      totalQuantity: number;
      totalMarketValue: number;
      totalInvested: number;
    }
  >();

  snapshots.forEach((snapshot) => {
    const existing = grouped.get(snapshot.key);
    if (!existing) {
      grouped.set(snapshot.key, {
        symbol: snapshot.symbol,
        name: snapshot.name,
        accountNames: new Set([snapshot.accountName]),
        totalQuantity: snapshot.quantity,
        totalMarketValue: snapshot.marketValue,
        totalInvested: snapshot.totalInvested,
      });
      return;
    }

    existing.accountNames.add(snapshot.accountName);
    existing.totalQuantity += snapshot.quantity;
    existing.totalMarketValue += snapshot.marketValue;
    existing.totalInvested += snapshot.totalInvested;
  });

  return Array.from(grouped.entries()).map(([key, group]) => {
    const currentPrice = group.totalQuantity > 0 ? group.totalMarketValue / group.totalQuantity : 0;
    const averageCost = group.totalQuantity > 0 ? group.totalInvested / group.totalQuantity : currentPrice;

    return {
      id: key,
      symbol: group.symbol,
      name: group.name,
      accountName: Array.from(group.accountNames).join(", "),
      averageCost: Number.isFinite(averageCost) ? averageCost : 0,
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
      totalInvested: Number.isFinite(group.totalInvested) ? group.totalInvested : 0,
      valueAveragingInvested: 0,
    };
  });
}

function ValueAveragingShell({ ctx }: { ctx: AddonContext }) {
  const { data: hostSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => ctx.api.settings.get(),
  });
  const baseCurrency = hostSettings?.baseCurrency ?? "USD";
  const {
    data: tickers = [],
    isLoading: isTickersLoading,
    refetch: refetchTickers,
  } = useQuery({
    queryKey: ["value-averaging-addon", "portfolio-tickers"],
    queryFn: async () => {
      const accounts = await ctx.api.accounts.getAll();
      const activeAccounts = accounts.filter((account) => account.isActive);
      const holdingsByAccount = await Promise.all(
        activeAccounts.map(async (account) => ({
          account,
          holdings: await ctx.api.portfolio.getHoldings(account.id),
        })),
      );

      const snapshots = holdingsByAccount
        .flatMap(({ account, holdings }) =>
          holdings
            .filter((holding) => String(holding.holdingType).toLowerCase() !== "cash")
            .map((holding) => mapHoldingToSnapshot(account, holding)),
        );

      return aggregateTickers(snapshots).sort((a, b) => b.currentPrice - a.currentPrice);
    },
  });

  const [currentPage, setCurrentPage] = useState<AddonPageTab>("dashboard");
  const [settings, setSettings] = useState<ValueAveragingSettings>(() => readSettings());
  const [generatedTransactions, setGeneratedTransactions] = useState<string[]>([]);

  useEffect(() => {
    if (!tickers.length) {
      return;
    }

    setSettings((prev) => {
      let hasNewTicker = false;
      const nextEnabledTickers = { ...prev.enabledTickers };
      const nextTickerAllocations = { ...prev.tickerAllocations };

      tickers.forEach((ticker) => {
        if (!(ticker.id in nextEnabledTickers)) {
          nextEnabledTickers[ticker.id] = false;
          hasNewTicker = true;
        }
        if (!(ticker.id in nextTickerAllocations)) {
          nextTickerAllocations[ticker.id] = 0;
          hasNewTicker = true;
        }
      });

      if (!hasNewTicker) {
        return prev;
      }

      const nextSettings: ValueAveragingSettings = {
        ...prev,
        enabledTickers: nextEnabledTickers,
        tickerAllocations: nextTickerAllocations,
      };
      saveSettings(nextSettings);
      ctx.api.logger.info("Detected new holdings and added them as disabled tickers");
      return nextSettings;
    });
  }, [tickers, ctx]);

  const enabledTickers = useMemo(
    () => tickers.filter((ticker) => settings.enabledTickers[ticker.id]),
    [settings.enabledTickers, tickers],
  );

  const fetchLatestPrices = async () => {
    await refetchTickers();
    ctx.api.logger.info("Value averaging portfolio holdings synced");
  };

  const autoGenerateTransactions = () => {
    const baseTopUp =
      settings.topUpMode === "amount"
        ? settings.topUpAmount
        : (enabledTickers.reduce((sum, ticker) => sum + ticker.currentPrice, 0) * settings.topUpPercentage) /
          100;

    const generated = enabledTickers.map((ticker) => {
      const allocation = (settings.tickerAllocations[ticker.id] ?? 0) / 100;
      const plannedAmount = baseTopUp * allocation;
      const amount =
        settings.maxTopUpEnabled && settings.maxTopUpMultiplier != null
          ? Math.min(plannedAmount, plannedAmount * settings.maxTopUpMultiplier)
          : plannedAmount;
      return `BUY ${ticker.symbol} in ${ticker.accountName}: ${formatCurrency(amount, baseCurrency)}`;
    });

    setGeneratedTransactions(generated);
    ctx.api.logger.info(`Auto-generated ${generated.length} value averaging transactions`);
  };

  // Addon-specific state → localStorage (saveSettings). Host app settings → ctx.api.settings:
  // https://wealthfolio.app/docs/addons/api-reference/
  const confirmSettings = (nextSettings: ValueAveragingSettings) => {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  if (currentPage === "settings") {
    return (
      <SettingsPage
        ctx={ctx}
        baseCurrency={baseCurrency}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        settings={settings}
        tickers={tickers}
        onConfirmSettings={confirmSettings}
      />
    );
  }

  return (
    <DashboardPage
      ctx={ctx}
      baseCurrency={baseCurrency}
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      settings={settings}
      tickers={tickers}
      isTickersLoading={isTickersLoading}
      onFetchLatestPrices={fetchLatestPrices}
      onAutoGenerateTransactions={autoGenerateTransactions}
      generatedTransactions={generatedTransactions}
    />
  );
}

const enable: AddonEnableFunction = (ctx) => {
  const sidebarItem = ctx.sidebar.addItem({
    id: "value-averaging-addon",
    label: "Value Averaging",
    icon: <Icons.Activity2 className="h-5 w-5" />,
    route: "/addon/value-averaging-addon",
    order: 100,
  });

  const AddonRoute = () => {
    const sharedQueryClient = ctx.api.query.getClient() as QueryClient;
    return (
      <QueryClientProvider client={sharedQueryClient}>
        <ValueAveragingShell ctx={ctx} />
      </QueryClientProvider>
    );
  };

  ctx.router.add({
    path: "/addon/value-averaging-addon",
    component: React.lazy(() => Promise.resolve({ default: AddonRoute })),
  });

  ctx.onDisable(() => {
    try {
      sidebarItem.remove();
    } catch (err) {
      ctx.api.logger.error("Failed to remove sidebar item: " + (err as Error).message);
    }
  });
};

export default enable;
