import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyPlaceholder,
  Icons,
  Input,
  Label,
  Page,
  PageContent,
  PageHeader,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wealthfolio/ui";
import React, { useEffect, useMemo, useState } from "react";
import { IntervalInput, PageTabSelector, type AddonPageTab } from "../components";
import { calculateInvestmentPlanByTicker, formatCurrency, getEffectiveGrowthPeriodIndex } from "../lib";
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
  orderDrafts: {
    id: string;
    symbol: string;
    enabled: boolean;
    autoDepositCash: boolean;
    action: "buy" | "sell" | "hold";
    advancePeriodOnConfirm?: boolean;
    accountId: string;
    accountName: string;
    accountOptions: { id: string; name: string }[];
    amount: number;
    quantity: number;
    unitPrice: number;
    currency: string;
  }[];
  isOrderSheetOpen: boolean;
  isSubmittingOrders: boolean;
  onOrderSheetOpenChange: (open: boolean) => void;
  onOrderDraftChange: (
    draftId: string,
    field: "enabled" | "autoDepositCash" | "accountId" | "amount" | "quantity" | "unitPrice",
    rawValue: string | number | boolean,
  ) => void;
  onConfirmGeneratedOrders: () => void | Promise<void>;
  deployRecords: DeployRecord[];
  onUpdateDeployRecord: (id: string, patch: Partial<Omit<DeployRecord, "id" | "createdAt">>) => void;
  onDeleteDeployRecord: (id: string) => void;
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

const DEPLOY_ACTION_OPTIONS: { value: "BUY" | "SELL"; label: string }[] = [
  { value: "BUY", label: "BUY" },
  { value: "SELL", label: "SELL" },
];

function deployRecordToPatch(
  record: DeployRecord,
): Partial<Omit<DeployRecord, "id" | "createdAt">> {
  return {
    symbol: record.symbol,
    action: record.action,
    accountName: record.accountName,
    periodIndex: record.periodIndex,
    amount: record.amount,
    quantity: record.quantity,
    unitPrice: record.unitPrice,
    currency: record.currency,
  };
}

function DeployRecordEditor({
  draft,
  onChange,
  formatRecordTime,
}: {
  draft: DeployRecord;
  onChange: (next: DeployRecord) => void;
  formatRecordTime: (iso: string) => string;
}) {
  const updateField = <K extends keyof DeployRecord>(key: K, value: DeployRecord[K]) => {
    onChange({ ...draft, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-muted-foreground mb-1 block text-xs">Time</Label>
        <p className="font-medium">{formatRecordTime(draft.createdAt)}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Ticker</span>
          <Input
            type="text"
            value={draft.symbol}
            onChange={(event) => updateField("symbol", event.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Action</span>
          <IntervalInput
            value={draft.action}
            onChange={(next) => updateField("action", next)}
            options={DEPLOY_ACTION_OPTIONS}
            placeholder="Select action"
            searchPlaceholder="Search action..."
            emptyText="No action found."
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="text-muted-foreground mb-1 block text-xs">Account</span>
          <Input
            type="text"
            value={draft.accountName}
            onChange={(event) => updateField("accountName", event.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Period</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={draft.periodIndex}
            onChange={(event) => updateField("periodIndex", Number.parseInt(event.target.value, 10) || 0)}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Currency</span>
          <Input
            type="text"
            value={draft.currency}
            onChange={(event) => updateField("currency", event.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Amount</span>
          <Input
            type="number"
            min={0}
            value={draft.amount}
            onChange={(event) => updateField("amount", Number(event.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Quantity</span>
          <Input
            type="number"
            min={0}
            step="0.00000001"
            value={draft.quantity}
            onChange={(event) => updateField("quantity", Number(event.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Price</span>
          <Input
            type="number"
            min={0}
            value={draft.unitPrice}
            onChange={(event) => updateField("unitPrice", Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
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
  orderDrafts,
  isOrderSheetOpen,
  isSubmittingOrders,
  onOrderSheetOpenChange,
  onOrderDraftChange,
  onConfirmGeneratedOrders,
  deployRecords,
  onUpdateDeployRecord,
  onDeleteDeployRecord,
}: DashboardPageProps) {
  const RECORDS_PER_PAGE = 10;
  const [selectedTickerId, setSelectedTickerId] = useState<string | null>(null);
  const [isTickerDetailSheetOpen, setIsTickerDetailSheetOpen] = useState(false);
  const [selectedDeployRecord, setSelectedDeployRecord] = useState<DeployRecord | null>(null);
  const [mobileDeployDraft, setMobileDeployDraft] = useState<DeployRecord | null>(null);
  const [isDeployRecordSheetOpen, setIsDeployRecordSheetOpen] = useState(false);
  const [desktopDeployEditDraft, setDesktopDeployEditDraft] = useState<DeployRecord | null>(null);
  const [isDesktopDeployEditOpen, setIsDesktopDeployEditOpen] = useState(false);
  const [deleteDeployConfirmId, setDeleteDeployConfirmId] = useState<string | null>(null);
  const [deployRecordsPage, setDeployRecordsPage] = useState(1);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(min-width: 640px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };
    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  const enabledTickers = useMemo(
    () => tickers.filter((ticker) => settings.enabledTickers[ticker.id]),
    [settings.enabledTickers, tickers],
  );

  const investmentPlan = useMemo(
    () => {
      const effectivePeriodIndex = getEffectiveGrowthPeriodIndex(settings, enabledTickers);
      return calculateInvestmentPlanByTicker(settings, enabledTickers, effectivePeriodIndex);
    },
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
  const deployRecordsTotalPages = Math.max(1, Math.ceil(deployRecords.length / RECORDS_PER_PAGE));
  const normalizedDeployRecordsPage = Math.min(deployRecordsPage, deployRecordsTotalPages);
  const paginatedDeployRecords = useMemo(() => {
    const startIndex = (normalizedDeployRecordsPage - 1) * RECORDS_PER_PAGE;
    return deployRecords.slice(startIndex, startIndex + RECORDS_PER_PAGE);
  }, [deployRecords, normalizedDeployRecordsPage]);
  useEffect(() => {
    if (deployRecordsPage > deployRecordsTotalPages) {
      setDeployRecordsPage(deployRecordsTotalPages);
    }
  }, [deployRecordsPage, deployRecordsTotalPages]);
  const formatRecordTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "--";
    }
    return date.toLocaleString();
  };

  useEffect(() => {
    if (selectedDeployRecord) {
      setMobileDeployDraft({ ...selectedDeployRecord });
    } else {
      setMobileDeployDraft(null);
    }
  }, [selectedDeployRecord]);

  const confirmDeleteDeployRecord = (id: string) => {
    onDeleteDeployRecord(id);
    setDeleteDeployConfirmId(null);
    if (selectedDeployRecord?.id === id) {
      setSelectedDeployRecord(null);
      setIsDeployRecordSheetOpen(false);
    }
    if (desktopDeployEditDraft?.id === id) {
      setDesktopDeployEditDraft(null);
      setIsDesktopDeployEditOpen(false);
    }
  };

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

  const orderEditorContent = (
    <div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 pt-2 pb-20 sm:space-y-3 sm:px-6 sm:pt-4 sm:pb-24">
      {!orderDrafts.length ? (
        <p className="text-muted-foreground text-sm">No buy/sell order generated yet.</p>
      ) : (
        <>
          {orderDrafts.map((draft) => {
            const fieldsLocked = draft.action === "hold" || !draft.enabled;
            const canSubmitRow = Boolean(draft.accountId) && draft.amount > 0 && draft.quantity > 0;
            const actionBadge =
              draft.action === "hold" ? (
                <Badge variant="outline" className="text-muted-foreground">
                  HOLD
                </Badge>
              ) : draft.action === "sell" ? (
                <Badge variant="destructive">SELL</Badge>
              ) : (
                <Badge variant="success">BUY</Badge>
              );
            return (
              <div
                key={draft.id}
                className={
                  draft.action === "hold"
                    ? "bg-muted/25 space-y-2 rounded-md border p-3 sm:space-y-3 sm:p-4"
                    : "bg-card space-y-2 rounded-md border p-3 sm:space-y-3 sm:p-4"
                }
              >
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <TickerLogo symbol={draft.symbol} />
                    <div className="font-medium">{draft.symbol}</div>
                    {actionBadge}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-muted-foreground text-xs">Auto deposit cash</span>
                      <Switch
                        checked={draft.autoDepositCash}
                        disabled={fieldsLocked || draft.action !== "buy"}
                        onCheckedChange={(checked) => onOrderDraftChange(draft.id, "autoDepositCash", checked)}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-4 sm:gap-3">
                  <label className={`text-sm ${fieldsLocked ? "pointer-events-none opacity-60" : ""}`}>
                    <span className="text-muted-foreground mb-1 block text-xs">Account</span>
                    <IntervalInput
                      disabled={fieldsLocked}
                      value={draft.accountId}
                      onChange={(nextAccountId) => onOrderDraftChange(draft.id, "accountId", nextAccountId)}
                      options={draft.accountOptions.map((option) => ({
                        value: option.id,
                        label: option.name,
                      }))}
                      placeholder="Select account"
                      searchPlaceholder="Search account..."
                      emptyText="No account found."
                    />
                  </label>
                  <label className={`text-sm ${fieldsLocked ? "pointer-events-none opacity-60" : ""}`}>
                    <span className="text-muted-foreground mb-1 block text-xs">Price</span>
                    <Input
                      type="number"
                      min={0}
                      disabled={fieldsLocked}
                      value={draft.unitPrice}
                      onChange={(event) => onOrderDraftChange(draft.id, "unitPrice", event.target.value)}
                    />
                  </label>
                  <label className={`text-sm ${fieldsLocked ? "pointer-events-none opacity-60" : ""}`}>
                    <span className="text-muted-foreground mb-1 block text-xs">Amount</span>
                    <Input
                      type="number"
                      min={0}
                      disabled={fieldsLocked}
                      value={draft.amount}
                      onChange={(event) => onOrderDraftChange(draft.id, "amount", event.target.value)}
                    />
                  </label>
                  <label className={`text-sm ${fieldsLocked ? "pointer-events-none opacity-60" : ""}`}>
                    <span className="text-muted-foreground mb-1 block text-xs">Quantity</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.00000001"
                      disabled={fieldsLocked}
                      value={draft.quantity}
                      onChange={(event) => onOrderDraftChange(draft.id, "quantity", event.target.value)}
                    />
                  </label>
                </div>
                {draft.action === "hold" && draft.advancePeriodOnConfirm ? (
                  <p className="text-muted-foreground text-xs">
                    Overflow gains held to next round — no sell order. Period advances when you confirm.
                  </p>
                ) : null}
                {draft.enabled && draft.action !== "hold" && !canSubmitRow ? (
                  <p className="text-destructive text-xs">Account, amount, and quantity must be greater than zero.</p>
                ) : null}
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  const orderEditorFooter = (
    <div className="bg-background sticky bottom-0 border-t px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex justify-end gap-1.5 sm:gap-2">
        <Button type="button" variant="outline" onClick={() => onOrderSheetOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirmGeneratedOrders}
          disabled={isSubmittingOrders || !orderDrafts.length}
        >
          {isSubmittingOrders ? "Submitting..." : "Confirm"}
        </Button>
      </div>
    </div>
  );

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
              <CardTitle>Records</CardTitle>
              <Button
                type="button"
                size="sm"
                className="h-10 w-10 rounded-full p-0 sm:h-9 sm:w-auto sm:rounded-md sm:px-3"
                onClick={onAutoGenerateTransactions}
              >
                <span className="text-lg leading-none sm:hidden">+</span>
                <span className="hidden sm:inline">+ Generate Orders</span>
              </Button>
            </CardHeader>
            <CardContent>
              {!deployRecords.length ? (
                <p className="text-muted-foreground text-sm">
                  No auto-generated transaction yet. Click "Auto generate transaction" to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden min-h-0 overflow-auto rounded-md border sm:block">
                    <Table>
                      <TableHeader className="bg-muted-foreground/5 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Ticker</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedDeployRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="whitespace-nowrap text-xs">{formatRecordTime(record.createdAt)}</TableCell>
                            <TableCell className="font-medium">{record.symbol}</TableCell>
                            <TableCell>
                              <Badge variant={record.action === "SELL" ? "destructive" : "success"}>{record.action}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{record.accountName}</TableCell>
                            <TableCell>{record.periodIndex}</TableCell>
                            <TableCell className="text-right">{formatCurrency(record.amount, record.currency)}</TableCell>
                            <TableCell className="text-right">{record.quantity.toFixed(8)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(record.unitPrice, record.currency)}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    aria-label={`Actions for ${record.symbol}`}
                                  >
                                    <Icons.MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      setDesktopDeployEditDraft({ ...record });
                                      setIsDesktopDeployEditOpen(true);
                                    }}
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      setDeleteDeployConfirmId(record.id);
                                    }}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-2 sm:hidden">
                    {paginatedDeployRecords.map((record) => (
                      <div key={record.id} className="bg-card rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <TickerLogo symbol={record.symbol} />
                              <div className="font-medium">{record.symbol}</div>
                            </div>
                            <div className="mt-2 space-y-0.5">
                              <div className="text-muted-foreground text-xs">{record.action}</div>
                              <div className="text-muted-foreground text-xs">{formatRecordTime(record.createdAt)}</div>
                              <div className="text-muted-foreground text-xs">{record.quantity.toFixed(8)} shares</div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="font-medium text-left">{formatCurrency(record.amount, record.currency)}</div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={`More details for ${record.symbol}`}
                              onClick={() => {
                                setSelectedDeployRecord(record);
                                setIsDeployRecordSheetOpen(true);
                              }}
                            >
                              <Icons.MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeployRecordsPage((prev) => Math.max(1, prev - 1))}
                      disabled={normalizedDeployRecordsPage <= 1}
                    >
                      <Icons.ChevronLeft className="mr-1 h-4 w-4" />
                      Prev
                    </Button>
                    <span className="text-muted-foreground text-xs">
                      Page {normalizedDeployRecordsPage} / {deployRecordsTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDeployRecordsPage((prev) => Math.min(deployRecordsTotalPages, prev + 1))
                      }
                      disabled={normalizedDeployRecordsPage >= deployRecordsTotalPages}
                    >
                      Next
                      <Icons.ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContent>
      {isDesktopViewport ? (
        <Dialog open={isOrderSheetOpen} onOpenChange={onOrderSheetOpenChange}>
          <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-6xl">
            <DialogHeader className="border-border border-b px-6 py-6">
              <DialogTitle>Confirm generated orders</DialogTitle>
            </DialogHeader>
            {orderEditorContent}
            {orderEditorFooter}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={isOrderSheetOpen} onOpenChange={onOrderSheetOpenChange}>
          <SheetContent
            side="bottom"
            className="mx-1 flex h-[80vh] flex-col rounded-t-4xl p-0 pb-10 [&>button.absolute]:hidden"
          >
            <SheetHeader className="border-border border-b px-3 py-5 sm:px-6 sm:py-5">
              <SheetTitle>Confirm generated orders</SheetTitle>
            </SheetHeader>
            {orderEditorContent}
            {orderEditorFooter}
          </SheetContent>
        </Sheet>
      )}
      <Dialog
        open={isDesktopDeployEditOpen}
        onOpenChange={(open) => {
          setIsDesktopDeployEditOpen(open);
          if (!open) {
            setDesktopDeployEditDraft(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-border border-b px-6 py-4">
            <DialogTitle>Edit deploy record</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6 pt-4 text-sm">
            {desktopDeployEditDraft ? (
              <DeployRecordEditor
                draft={desktopDeployEditDraft}
                onChange={setDesktopDeployEditDraft}
                formatRecordTime={formatRecordTime}
              />
            ) : null}
          </div>
          <DialogFooter className="border-border border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDesktopDeployEditOpen(false);
                setDesktopDeployEditDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!desktopDeployEditDraft}
              onClick={() => {
                if (!desktopDeployEditDraft) {
                  return;
                }
                onUpdateDeployRecord(desktopDeployEditDraft.id, deployRecordToPatch(desktopDeployEditDraft));
                setIsDesktopDeployEditOpen(false);
                setDesktopDeployEditDraft(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet
        open={isDeployRecordSheetOpen}
        onOpenChange={(open) => {
          setIsDeployRecordSheetOpen(open);
          if (!open) {
            setSelectedDeployRecord(null);
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="mx-1 flex h-[75vh] flex-col rounded-t-4xl p-0 pb-15 [&>button.absolute]:hidden"
        >
          <SheetHeader className="border-border shrink-0 border-b px-6 py-4">
            <SheetTitle>Deploy record</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6 pt-4 text-sm">
            {mobileDeployDraft ? (
              <DeployRecordEditor
                draft={mobileDeployDraft}
                onChange={setMobileDeployDraft}
                formatRecordTime={formatRecordTime}
              />
            ) : (
              <p className="text-muted-foreground">Select a record to see details.</p>
            )}
          </div>
          <div className="bg-background shrink-0 border-t px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="w-full"
              disabled={!mobileDeployDraft}
              onClick={() => {
                if (!mobileDeployDraft) {
                  return;
                }
                onUpdateDeployRecord(mobileDeployDraft.id, deployRecordToPatch(mobileDeployDraft));
              }}
            >
              Save
            </Button>
            <div className="mt-2 flex justify-center">
              <Button
                type="button"
                variant="destructive"
                className="mx-auto w-[80%]"
                disabled={!mobileDeployDraft}
                onClick={() => {
                  if (mobileDeployDraft) {
                    setDeleteDeployConfirmId(mobileDeployDraft.id);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={deleteDeployConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDeployConfirmId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete deploy record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the record from your list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteDeployConfirmId) {
                  confirmDeleteDeployRecord(deleteDeployConfirmId);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
