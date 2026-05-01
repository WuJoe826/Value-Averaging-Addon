import { QueryClientProvider, type QueryClient, useQuery } from "@tanstack/react-query";
import type { AddonContext, AddonEnableFunction } from "@wealthfolio/addon-sdk";
import { Icons } from "@wealthfolio/ui";
import React, { useMemo, useState } from "react";
import type { AddonPageTab } from "./components/page-tab-selector";
import { DEFAULT_TICKERS, formatCurrency, readSettings, saveSettings } from "./lib";
import { DashboardPage, SettingsPage } from "./pages";
import type { PortfolioTicker, ValueAveragingSettings } from "./types";

function ValueAveragingShell({ ctx }: { ctx: AddonContext }) {
  const { data: hostSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => ctx.api.settings.get(),
  });
  const baseCurrency = hostSettings?.baseCurrency ?? "USD";

  const [currentPage, setCurrentPage] = useState<AddonPageTab>("dashboard");
  const [settings, setSettings] = useState<ValueAveragingSettings>(() => readSettings());
  const [tickers, setTickers] = useState<PortfolioTicker[]>(DEFAULT_TICKERS);
  const [generatedTransactions, setGeneratedTransactions] = useState<string[]>([]);

  const enabledTickers = useMemo(
    () => tickers.filter((ticker) => settings.enabledTickers[ticker.id]),
    [settings.enabledTickers, tickers],
  );

  const fetchLatestPrices = () => {
    setTickers((prev) =>
      prev.map((ticker) => {
        const changeRate = (Math.random() * 6 - 3) / 100;
        const nextPrice = Number((ticker.currentPrice * (1 + changeRate)).toFixed(2));
        return { ...ticker, currentPrice: Math.max(0.01, nextPrice) };
      }),
    );
    ctx.api.logger.info("Value averaging prices refreshed");
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
