import { QueryClientProvider, type QueryClient, useQuery } from "@tanstack/react-query";
import type { Account, AddonContext, AddonEnableFunction, Holding } from "@wealthfolio/addon-sdk";
import { Icons } from "@wealthfolio/ui";
import React, { useEffect, useMemo, useState } from "react";
import type { AddonPageTab } from "./components/page-tab-selector";
import {
  buildDefaultSettings,
  calculateHoldingInvestmentPlan,
  clearDeployRecords,
  clearSettings,
  formatCurrency,
  getEffectiveGrowthPeriodIndex,
  readDeployRecords,
  readSettings,
  saveDeployRecords,
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
  periodIndex: number;
  symbol: string;
  enabled: boolean;
  autoDepositCash: boolean;
  action: "buy" | "sell" | "hold";
  /** When true, confirming updates tickerExecutedPeriod without creating an activity (overflow hold). */
  advancePeriodOnConfirm: boolean;
  accountId: string;
  accountName: string;
  accountOptions: TickerAccountOption[];
  amount: number;
  quantity: number;
  unitPrice: number;
  currency: string;
  instrumentId: string | null;
}

interface DeployRecord {
  id: string;
  createdAt: string;
  symbol: string;
  action: "BUY" | "SELL";
  accountName: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  currency: string;
  periodIndex: number;
}

type DeployRecordUpdate = Partial<Omit<DeployRecord, "id" | "createdAt">>;

const QUANTITY_DECIMAL_PLACES = 8;

function truncateToDecimals(value: number, decimals: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.trunc(value * factor) / factor;
}

function isDuplicateActivityError(message: string): boolean {
  return message.toLowerCase().includes("duplicate activity detected");
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
  const [deployRecords, setDeployRecords] = useState<DeployRecord[]>(() => readDeployRecords());
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
    const effectivePeriodIndex = getEffectiveGrowthPeriodIndex(settings, enabledTickers);
    const minExecutedPeriod = enabledTickers.reduce((min, ticker) => {
      const executed = Math.max(0, Number(settings.tickerExecutedPeriods[ticker.id] ?? 0));
      return Math.min(min, executed);
    }, Number.POSITIVE_INFINITY);
    const synchronizationThreshold = Number.isFinite(minExecutedPeriod) ? minExecutedPeriod + 1 : 1;
    const eligibleTickers = enabledTickers.filter(
      (ticker) => {
        const executed = Math.max(0, Number(settings.tickerExecutedPeriods[ticker.id] ?? 0));
        // Gate by effective period and by cross-ticker synchronization.
        // A ticker that is ahead must wait until lagging tickers catch up.
        return executed < effectivePeriodIndex && executed < synchronizationThreshold;
      },
    );
    const nextDrafts: GeneratedOrderDraft[] = eligibleTickers
      .map((ticker) => {
        // Always calculate based on the full enabled portfolio context.
        // Using only eligible tickers distorts per-period top-up math.
        const plan = calculateHoldingInvestmentPlan(ticker, settings, enabledTickers, effectivePeriodIndex);
        if (plan.action === "hold") {
          if (!plan.overflowHoldDeferred) {
            return null;
          }
          const selectedAccount = resolveSelectedAccount(ticker);
          const unitPrice = Number.isFinite(ticker.currentPrice) ? Math.max(0, ticker.currentPrice) : 0;
          const deferredDraft: GeneratedOrderDraft = {
            id: `${ticker.id}-hold-deferred`,
            tickerId: ticker.id,
            periodIndex: effectivePeriodIndex,
            symbol: ticker.symbol,
            enabled: false,
            autoDepositCash: false,
            action: "hold",
            advancePeriodOnConfirm: true,
            accountId: selectedAccount?.id ?? "",
            accountName: selectedAccount?.name ?? ticker.accountName,
            accountOptions: ticker.accountOptions,
            amount: 0,
            quantity: 0,
            unitPrice,
            currency: baseCurrency,
            instrumentId: ticker.instrumentId,
          };
          return deferredDraft;
        }
        const selectedAccount = resolveSelectedAccount(ticker);
        const unitPrice = Number.isFinite(ticker.currentPrice) ? Math.max(0, ticker.currentPrice) : 0;
        const amount = Math.max(0, Math.abs(plan.amountToInvest));
        const quantity = unitPrice > 0 ? truncateToDecimals(amount / unitPrice, QUANTITY_DECIMAL_PLACES) : 0;
        const draft: GeneratedOrderDraft = {
          id: `${ticker.id}-${plan.action}`,
          tickerId: ticker.id,
          periodIndex: effectivePeriodIndex,
          symbol: ticker.symbol,
          enabled: true,
          autoDepositCash: false,
          action: plan.action,
          advancePeriodOnConfirm: false,
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
        if (draft.advancePeriodOnConfirm || draft.action === "hold") {
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

  /** Persists deploy period (`tickerExecutedPeriods`) only when the user clicks Confirm on the order sheet. */
  const confirmGeneratedOrders = async () => {
    if (!orderDrafts.length || isSubmittingOrders) {
      return;
    }

    const validDrafts = orderDrafts.filter(
      (draft) =>
        draft.enabled &&
        draft.action !== "hold" &&
        draft.accountId &&
        draft.amount > 0 &&
        draft.quantity > 0,
    );
    const hasOverflowPeriodAdvance = orderDrafts.some((draft) => draft.advancePeriodOnConfirm);
    if (!validDrafts.length && !hasOverflowPeriodAdvance) {
      ctx.api.logger.warn("No valid generated orders to submit.");
      return;
    }

    setIsSubmittingOrders(true);
    let successCount = 0;
    /** Period indices to persist — only filled inside this confirm handler (Confirm button). */
    const periodIndexAfterActivity = new Map<string, number>();
    const successRecords: DeployRecord[] = [];
    const errors: string[] = [];
    const activityDate = new Date().toISOString();

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
        // Advance executed period only after successful host activity (confirm flow only).
        periodIndexAfterActivity.set(draft.tickerId, draft.periodIndex);
        const actionLabel: "BUY" | "SELL" = draft.action === "sell" ? "SELL" : "BUY";
        successRecords.push({
          id: `${draft.tickerId}-${Date.now()}`,
          createdAt: new Date().toISOString(),
          symbol: draft.symbol,
          action: actionLabel,
          accountName: draft.accountName,
          amount: draft.amount,
          quantity: truncateToDecimals(draft.quantity, QUANTITY_DECIMAL_PLACES),
          unitPrice: draft.unitPrice,
          currency: draft.currency,
          periodIndex: draft.periodIndex,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : JSON.stringify(err);
        if (isDuplicateActivityError(message)) {
          // Treat duplicate as idempotent success: the activity already exists.
          successCount += 1;
          periodIndexAfterActivity.set(draft.tickerId, draft.periodIndex);
          const actionLabel: "BUY" | "SELL" = draft.action === "sell" ? "SELL" : "BUY";
          successRecords.push({
            id: `${draft.tickerId}-${Date.now()}-duplicate`,
            createdAt: new Date().toISOString(),
            symbol: draft.symbol,
            action: actionLabel,
            accountName: draft.accountName,
            amount: draft.amount,
            quantity: truncateToDecimals(draft.quantity, QUANTITY_DECIMAL_PLACES),
            unitPrice: draft.unitPrice,
            currency: draft.currency,
            periodIndex: draft.periodIndex,
          });
          ctx.api.logger.info(`[duplicate-treated-as-success] ${draft.symbol}: ${message}`);
          continue;
        }
        errors.push(`${draft.symbol}: ${message}`);
      }
    }

    setIsSubmittingOrders(false);

    const activityBatchClean = errors.length === 0;
    const overflowPeriodTickerCount = activityBatchClean
      ? orderDrafts.filter((draft) => draft.advancePeriodOnConfirm).length
      : 0;

    const shouldPersistExecutedPeriods =
      successCount > 0 || (activityBatchClean && overflowPeriodTickerCount > 0);

    if (shouldPersistExecutedPeriods) {
      setSettings((prev) => {
        const nextExecutedPeriods = { ...prev.tickerExecutedPeriods };
        periodIndexAfterActivity.forEach((executedPeriodFromDraft, tickerId) => {
          const previousExecuted = Math.max(0, Number(nextExecutedPeriods[tickerId] ?? 0));
          nextExecutedPeriods[tickerId] = Math.max(previousExecuted, executedPeriodFromDraft);
        });
        if (activityBatchClean) {
          orderDrafts.forEach((draft) => {
            if (!draft.advancePeriodOnConfirm) {
              return;
            }
            const previousExecuted = Math.max(0, Number(nextExecutedPeriods[draft.tickerId] ?? 0));
            nextExecutedPeriods[draft.tickerId] = Math.max(previousExecuted, draft.periodIndex);
          });
        }
        const nextSettings = {
          ...prev,
          tickerExecutedPeriods: nextExecutedPeriods,
        };
        saveSettings(nextSettings);
        return nextSettings;
      });
    }

    if (successCount > 0) {
      setDeployRecords((prev) => {
        const nextRecords = [...successRecords, ...prev];
        saveDeployRecords(nextRecords);
        return nextRecords;
      });
    }

    if (successCount > 0 || (activityBatchClean && overflowPeriodTickerCount > 0)) {
      await refetchTickers();
    }

    if (!errors.length) {
      const parts: string[] = [];
      if (successCount > 0) {
        parts.push(`created ${successCount} activities`);
      }
      if (overflowPeriodTickerCount > 0) {
        parts.push(`advanced period for ${overflowPeriodTickerCount} overflow hold ticker(s)`);
      }
      ctx.api.logger.info(
        `Confirm complete${parts.length ? `: ${parts.join("; ")}` : ""}.`,
      );
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

  const updateDeployRecord = (id: string, patch: DeployRecordUpdate) => {
    setDeployRecords((prev) => {
      const index = prev.findIndex((r) => r.id === id);
      if (index === -1) {
        return prev;
      }
      const current = prev[index];
      const next: DeployRecord = { ...current };
      if (patch.symbol !== undefined) {
        next.symbol = String(patch.symbol).trim();
      }
      if (patch.accountName !== undefined) {
        next.accountName = String(patch.accountName).trim();
      }
      if (patch.action !== undefined) {
        if (patch.action === "BUY" || patch.action === "SELL") {
          next.action = patch.action;
        }
      }
      if (patch.currency !== undefined) {
        const c = String(patch.currency).trim().toUpperCase();
        next.currency = c || current.currency;
      }
      if (patch.amount !== undefined) {
        const n = Number(patch.amount);
        if (Number.isFinite(n)) {
          next.amount = Math.max(0, n);
        }
      }
      if (patch.unitPrice !== undefined) {
        const n = Number(patch.unitPrice);
        if (Number.isFinite(n)) {
          next.unitPrice = Math.max(0, n);
        }
      }
      if (patch.quantity !== undefined) {
        const n = Number(patch.quantity);
        if (Number.isFinite(n)) {
          next.quantity = Math.max(0, truncateToDecimals(n, QUANTITY_DECIMAL_PLACES));
        }
      }
      if (patch.periodIndex !== undefined) {
        const n = Number(patch.periodIndex);
        if (Number.isFinite(n)) {
          next.periodIndex = Math.max(0, Math.floor(n));
        }
      }
      const out = [...prev];
      out[index] = next;
      saveDeployRecords(out);
      return out;
    });
  };

  const deleteDeployRecord = (id: string) => {
    setDeployRecords((prev) => {
      const out = prev.filter((r) => r.id !== id);
      saveDeployRecords(out);
      return out;
    });
  };

  const resetAddonData = () => {
    const { settings: resetSettings } = hydrateSettingsForTickers(buildDefaultSettings(), tickers);
    clearSettings();
    clearDeployRecords();
    saveSettings(resetSettings);
    setDeployRecords([]);
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
        deployRecords={deployRecords}
        onUpdateDeployRecord={updateDeployRecord}
        onDeleteDeployRecord={deleteDeployRecord}
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
