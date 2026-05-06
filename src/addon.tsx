import { QueryClientProvider, type QueryClient, useQuery } from "@tanstack/react-query";
import type { Account, AddonContext, AddonEnableFunction, Holding } from "@wealthfolio/addon-sdk";
import { Icons } from "@wealthfolio/ui";
import React, { useEffect, useMemo, useState } from "react";
import type { AddonPageTab } from "./components/page-tab-selector";
import {
  buildDefaultSettings,
  calculateHoldingInvestmentPlan,
  clearSettings,
  formatCurrency,
  getTodayIsoDate,
  readSettings,
  saveSettings,
} from "./lib";
import { DashboardPage, SettingsPage } from "./pages";
import type { PortfolioTicker, TickerAccountOption, ValueAveragingSettings } from "./types";

interface RawTickerSnapshot {
  key: string;
  instrumentId: string | null;
  symbol: string;
  name: string;
  accountId: string;
  accountName: string;
  quantity: number;
  marketValue: number;
  totalInvested: number;
  currentPrice: number;
}

interface GeneratedOrderDraft {
  id: string;
  tickerId: string;
  symbol: string;
  enabled: boolean;
  autoDepositCash: boolean;
  action: "buy" | "sell";
  accountId: string;
  accountName: string;
  accountOptions: TickerAccountOption[];
  amount: number;
  quantity: number;
  unitPrice: number;
  currency: string;
  instrumentId: string | null;
}

const QUANTITY_DECIMAL_PLACES = 8;

function truncateToDecimals(value: number, decimals: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.trunc(value * factor) / factor;
}

function hydrateSettingsForTickers(
  baseSettings: ValueAveragingSettings,
  tickers: PortfolioTicker[],
): { settings: ValueAveragingSettings; hasChanges: boolean } {
  let hasChanges = false;
  const nextEnabledTickers = { ...baseSettings.enabledTickers };
  const nextTickerAllocations = { ...baseSettings.tickerAllocations };
  const nextTickerAccountSelection = { ...baseSettings.tickerAccountSelection };
  const nextTickerExecutedPeriods = { ...baseSettings.tickerExecutedPeriods };
  const nextInitialDeploymentShares = { ...baseSettings.initialDeploymentShares };
  const nextInitialDeploymentValue = { ...baseSettings.initialDeploymentValue };

  tickers.forEach((ticker) => {
    if (!(ticker.id in nextEnabledTickers)) {
      nextEnabledTickers[ticker.id] = false;
      hasChanges = true;
    }
    if (!(ticker.id in nextTickerAllocations)) {
      nextTickerAllocations[ticker.id] = 0;
      hasChanges = true;
    }
    if (!(ticker.id in nextTickerExecutedPeriods)) {
      nextTickerExecutedPeriods[ticker.id] = 0;
      hasChanges = true;
    }
    const fallbackAccountId = ticker.accountOptions[0]?.id ?? "";
    if (!(ticker.id in nextTickerAccountSelection) && fallbackAccountId) {
      nextTickerAccountSelection[ticker.id] = fallbackAccountId;
      hasChanges = true;
    }
    if (
      ticker.id in nextTickerAccountSelection &&
      !ticker.accountOptions.some((option) => option.id === nextTickerAccountSelection[ticker.id]) &&
      fallbackAccountId
    ) {
      nextTickerAccountSelection[ticker.id] = fallbackAccountId;
      hasChanges = true;
    }
    if (!(ticker.id in nextInitialDeploymentShares)) {
      nextInitialDeploymentShares[ticker.id] = Number.isFinite(ticker.quantity) ? ticker.quantity : 0;
      hasChanges = true;
    }
    if (!(ticker.id in nextInitialDeploymentValue)) {
      const initialValue = Number.isFinite(ticker.currentPrice * ticker.quantity) ? ticker.currentPrice * ticker.quantity : 0;
      nextInitialDeploymentValue[ticker.id] = initialValue;
      hasChanges = true;
    }
  });

  if (!hasChanges) {
    return { settings: baseSettings, hasChanges: false };
  }

  return {
    settings: {
      ...baseSettings,
      enabledTickers: nextEnabledTickers,
      tickerAllocations: nextTickerAllocations,
      tickerAccountSelection: nextTickerAccountSelection,
      tickerExecutedPeriods: nextTickerExecutedPeriods,
      initialDeploymentShares: nextInitialDeploymentShares,
      initialDeploymentValue: nextInitialDeploymentValue,
    },
    hasChanges: true,
  };
}

function mapHoldingToSnapshot(account: Account, holding: Holding): RawTickerSnapshot {
  const symbol = holding.instrument?.symbol ?? holding.id;
  const name = holding.instrument?.name ?? symbol;
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedInstrumentId = String(holding.instrument?.id ?? "")
    .trim()
    .toLowerCase();
  const quantity = Number(holding.quantity) || 0;
  const marketValue = Number(holding.marketValue?.local ?? holding.marketValue?.base ?? 0);
  const totalInvested = Number(holding.costBasis?.local ?? holding.costBasis?.base ?? 0);
  const currentPrice = Number(holding.price ?? (quantity > 0 ? marketValue / quantity : 0));

  return {
    key: normalizedInstrumentId ? `instrument::${normalizedInstrumentId}` : `symbol::${normalizedSymbol}`,
    instrumentId: normalizedInstrumentId || null,
    symbol,
    name,
    accountId: account.id,
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
      instrumentId: string | null;
      symbol: string;
      name: string;
      accounts: Map<string, string>;
      totalQuantity: number;
      totalMarketValue: number;
      totalInvested: number;
    }
  >();

  snapshots.forEach((snapshot) => {
    const existing = grouped.get(snapshot.key);
    if (!existing) {
      grouped.set(snapshot.key, {
        instrumentId: snapshot.instrumentId,
        symbol: snapshot.symbol,
        name: snapshot.name,
        accounts: new Map([[snapshot.accountId, snapshot.accountName]]),
        totalQuantity: snapshot.quantity,
        totalMarketValue: snapshot.marketValue,
        totalInvested: snapshot.totalInvested,
      });
      return;
    }

    existing.accounts.set(snapshot.accountId, snapshot.accountName);
    existing.totalQuantity += snapshot.quantity;
    existing.totalMarketValue += snapshot.marketValue;
    existing.totalInvested += snapshot.totalInvested;
  });

  return Array.from(grouped.entries()).map(([key, group]) => {
    const accountOptions = Array.from(group.accounts.entries()).map(([id, name]) => ({ id, name }));
    const currentPrice = group.totalQuantity > 0 ? group.totalMarketValue / group.totalQuantity : 0;
    const averageCost = group.totalQuantity > 0 ? group.totalInvested / group.totalQuantity : currentPrice;

    return {
      id: key,
      symbol: group.symbol,
      name: group.name,
      accountName: accountOptions.map((option) => option.name).join(", "),
      accountOptions,
      instrumentId: group.instrumentId,
      quantity: Number.isFinite(group.totalQuantity) ? group.totalQuantity : 0,
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
  const [orderDrafts, setOrderDrafts] = useState<GeneratedOrderDraft[]>([]);
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);
  const [isSubmittingOrders, setIsSubmittingOrders] = useState(false);

  useEffect(() => {
    if (!tickers.length) {
      return;
    }

    setSettings((prev) => {
      const { settings: hydratedSettings, hasChanges } = hydrateSettingsForTickers(prev, tickers);
      if (!hasChanges) {
        return prev;
      }
      saveSettings(hydratedSettings);
      ctx.api.logger.info("Detected new holdings and initialized value averaging baselines");
      return hydratedSettings;
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

  const resolveSelectedAccount = (ticker: PortfolioTicker): TickerAccountOption | null => {
    if (!ticker.accountOptions.length) {
      return null;
    }
    const preferredAccountId = settings.tickerAccountSelection[ticker.id];
    return (
      ticker.accountOptions.find((option) => option.id === preferredAccountId) ??
      ticker.accountOptions[0] ??
      null
    );
  };

  const autoGenerateTransactions = () => {
    const nextDrafts: GeneratedOrderDraft[] = enabledTickers
      .map((ticker) => {
        const plan = calculateHoldingInvestmentPlan(ticker, settings, enabledTickers);
        if (plan.action === "hold") {
          return null;
        }
        const selectedAccount = resolveSelectedAccount(ticker);
        const unitPrice = Number.isFinite(ticker.currentPrice) ? Math.max(0, ticker.currentPrice) : 0;
        const amount = Math.max(0, Math.abs(plan.amountToInvest));
        const quantity = unitPrice > 0 ? truncateToDecimals(amount / unitPrice, QUANTITY_DECIMAL_PLACES) : 0;
        const draft: GeneratedOrderDraft = {
          id: `${ticker.id}-${plan.action}`,
          tickerId: ticker.id,
          symbol: ticker.symbol,
          enabled: true,
          autoDepositCash: false,
          action: plan.action,
          accountId: selectedAccount?.id ?? "",
          accountName: selectedAccount?.name ?? ticker.accountName,
          accountOptions: ticker.accountOptions,
          amount,
          quantity,
          unitPrice,
          currency: baseCurrency,
          instrumentId: ticker.instrumentId,
        };
        return draft;
      })
      .filter((draft): draft is GeneratedOrderDraft => draft !== null);

    setOrderDrafts(nextDrafts);
    setIsOrderSheetOpen(nextDrafts.length > 0);
    ctx.api.logger.info(`Auto-generated ${nextDrafts.length} value averaging order drafts`);
  };

  const updateOrderDraft = (
    draftId: string,
    field: "enabled" | "autoDepositCash" | "accountId" | "amount" | "quantity" | "unitPrice",
    rawValue: string | number | boolean,
  ) => {
    setOrderDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== draftId) {
          return draft;
        }
        if (field === "enabled") {
          return {
            ...draft,
            enabled: Boolean(rawValue),
          };
        }
        if (field === "autoDepositCash") {
          return {
            ...draft,
            autoDepositCash: Boolean(rawValue),
          };
        }
        if (field === "accountId") {
          const nextAccountId = String(rawValue);
          const matchedAccount = draft.accountOptions.find((option) => option.id === nextAccountId);
          return {
            ...draft,
            accountId: nextAccountId,
            accountName: matchedAccount?.name ?? draft.accountName,
          };
        }
        const parsedValue = Number(rawValue);
        const safeValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;
        if (field === "amount") {
          const computedQuantity =
            draft.unitPrice > 0 ? truncateToDecimals(safeValue / draft.unitPrice, QUANTITY_DECIMAL_PLACES) : draft.quantity;
          return {
            ...draft,
            amount: safeValue,
            quantity: computedQuantity,
          };
        }
        if (field === "unitPrice") {
          const normalizedQuantity = truncateToDecimals(draft.quantity, QUANTITY_DECIMAL_PLACES);
          return {
            ...draft,
            unitPrice: safeValue,
            amount: safeValue > 0 ? normalizedQuantity * safeValue : draft.amount,
          };
        }
        const normalizedQuantity = truncateToDecimals(safeValue, QUANTITY_DECIMAL_PLACES);
        return {
          ...draft,
          quantity: normalizedQuantity,
          amount: draft.unitPrice > 0 ? normalizedQuantity * draft.unitPrice : draft.amount,
        };
      }),
    );
  };

  const confirmGeneratedOrders = async () => {
    if (!orderDrafts.length || isSubmittingOrders) {
      return;
    }

    const validDrafts = orderDrafts.filter(
      (draft) => draft.enabled && draft.accountId && draft.amount > 0 && draft.quantity > 0,
    );
    if (!validDrafts.length) {
      ctx.api.logger.warn("No valid generated orders to submit.");
      return;
    }

    setIsSubmittingOrders(true);
    let successCount = 0;
    const successfulTickerIds = new Set<string>();
    const successRecords: string[] = [];
    const errors: string[] = [];
    const activityDate = getTodayIsoDate();

    for (const draft of validDrafts) {
      try {
        if (draft.action === "buy" && draft.autoDepositCash) {
          await ctx.api.activities.create({
            accountId: draft.accountId,
            activityType: "DEPOSIT",
            activityDate,
            isDraft: false,
            amount: draft.amount,
            currency: draft.currency,
            comment: `Auto deposit cash for ${draft.symbol} order`,
          });
        }
        const activityPayload = {
          accountId: draft.accountId,
          activityType: draft.action === "buy" ? "BUY" : "SELL",
          activityDate,
          isDraft: false,
          amount: draft.amount,
          quantity: truncateToDecimals(draft.quantity, QUANTITY_DECIMAL_PLACES),
          unitPrice: draft.unitPrice,
          currency: draft.currency,
          comment: "Value Averaging auto-generated",
          // Host expects AssetResolutionInput object here.
          symbol: draft.instrumentId
            ? {
                id: draft.instrumentId,
                symbol: draft.symbol,
              }
            : {
                symbol: draft.symbol,
              },
        };
        await ctx.api.activities.create({
          ...activityPayload,
        });
        successCount += 1;
        // Only filled BUY/SELL orders advance period immediately.
        // HOLD actions should wait for calendar period rollover.
        if (draft.action === "buy" || draft.action === "sell") {
          successfulTickerIds.add(draft.tickerId);
        }
        const actionLabel = draft.action === "sell" ? "SELL" : "BUY";
        successRecords.push(
          `${actionLabel} ${draft.symbol} in ${draft.accountName}: ${formatCurrency(draft.amount, draft.currency)}`,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : JSON.stringify(err);
        errors.push(`${draft.symbol}: ${message}`);
      }
    }

    setIsSubmittingOrders(false);

    if (successCount > 0) {
      setSettings((prev) => {
        const nextExecutedPeriods = { ...prev.tickerExecutedPeriods };
        successfulTickerIds.forEach((tickerId) => {
          nextExecutedPeriods[tickerId] = Math.max(0, Number(nextExecutedPeriods[tickerId] ?? 0)) + 1;
        });
        const nextSettings = {
          ...prev,
          tickerExecutedPeriods: nextExecutedPeriods,
        };
        saveSettings(nextSettings);
        return nextSettings;
      });
      setGeneratedTransactions(successRecords);
      await refetchTickers();
    }

    if (!errors.length) {
      ctx.api.logger.info(`Created ${successCount} activities from auto-generated orders.`);
      setIsOrderSheetOpen(false);
      return;
    }

    ctx.api.logger.warn(`Created ${successCount} activities, failed ${errors.length}.`);
    ctx.api.logger.warn(`Auto-generate activity failures: ${errors.join("; ")}`);
  };

  // Addon-specific state → localStorage (saveSettings). Host app settings → ctx.api.settings:
  // https://wealthfolio.app/docs/addons/api-reference/
  const confirmSettings = (nextSettings: ValueAveragingSettings) => {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  const resetAddonData = () => {
    const { settings: resetSettings } = hydrateSettingsForTickers(buildDefaultSettings(), tickers);
    clearSettings();
    saveSettings(resetSettings);
    setGeneratedTransactions([]);
    setOrderDrafts([]);
    setIsOrderSheetOpen(false);
    setSettings(resetSettings);
    setCurrentPage("dashboard");
    ctx.api.logger.info("Value averaging addon data reset to first-use state");
  };

  if (currentPage === "settings") {
    return (
      <div className="mb-5">
        <SettingsPage
          ctx={ctx}
          baseCurrency={baseCurrency}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          settings={settings}
          tickers={tickers}
          onConfirmSettings={confirmSettings}
          onResetAddonData={resetAddonData}
        />
      </div>
    );
  }

  return (
    <div className="pb-5">
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
        orderDrafts={orderDrafts}
        isOrderSheetOpen={isOrderSheetOpen}
        isSubmittingOrders={isSubmittingOrders}
        onOrderSheetOpenChange={setIsOrderSheetOpen}
        onOrderDraftChange={updateOrderDraft}
        onConfirmGeneratedOrders={confirmGeneratedOrders}
        generatedTransactions={generatedTransactions}
      />
    </div>
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
