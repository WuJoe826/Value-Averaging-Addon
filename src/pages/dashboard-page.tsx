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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyPlaceholder,
  Icons,
  Input,
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
    action: "buy" | "sell";
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
}: DashboardPageProps) {
  const RECORDS_PER_PAGE = 10;
  const [selectedTickerId, setSelectedTickerId] = useState<string | null>(null);
  const [isTickerDetailSheetOpen, setIsTickerDetailSheetOpen] = useState(false);
  const [selectedDeployRecord, setSelectedDeployRecord] = useState<DeployRecord | null>(null);
  const [isDeployRecordSheetOpen, setIsDeployRecordSheetOpen] = useState(false);
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
    <div className="min-h-0 flex-1 space-y-3 overflow-auto px-6 pt-4 pb-24">
      {!orderDrafts.length ? (
        <p className="text-muted-foreground text-sm">No buy/sell order generated yet.</p>
      ) : (
        <>
          {orderDrafts.map((draft) => {
            const canSubmit = Boolean(draft.accountId) && draft.amount > 0 && draft.quantity > 0;
            return (
              <div key={draft.id} className="bg-card space-y-3 rounded-md border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <TickerLogo symbol={draft.symbol} />
                    <div className="font-medium">{draft.symbol}</div>
                    <Badge variant={draft.action === "sell" ? "destructive" : "success"}>
                      {draft.action === "sell" ? "SELL" : "BUY"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">Auto deposit cash</span>
                      <Switch
                        checked={draft.autoDepositCash}
                        disabled={draft.action !== "buy"}
                        onCheckedChange={(checked) => onOrderDraftChange(draft.id, "autoDepositCash", checked)}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="text-muted-foreground mb-1 block text-xs">Account</span>
                    <IntervalInput
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
                  <label className="text-sm">
                    <span className="text-muted-foreground mb-1 block text-xs">Price</span>
                    <Input
                      type="number"
                      min={0}
                      value={draft.unitPrice}
                      onChange={(event) => onOrderDraftChange(draft.id, "unitPrice", event.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-muted-foreground mb-1 block text-xs">Amount</span>
                    <Input
                      type="number"
                      min={0}
                      value={draft.amount}
                      onChange={(event) => onOrderDraftChange(draft.id, "amount", event.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-muted-foreground mb-1 block text-xs">Quantity</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.00000001"
                      value={draft.quantity}
                      onChange={(event) => onOrderDraftChange(draft.id, "quantity", event.target.value)}
                    />
                  </label>
                </div>
                {!canSubmit ? (
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
    <div className="bg-background sticky bottom-0 border-t px-6 py-4">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOrderSheetOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirmGeneratedOrders}
          disabled={isSubmittingOrders || !orderDrafts.length}
        >
          {isSubmittingOrders ? "Submitting..." : "Confirm and create activity"}
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
            <DialogHeader className="border-border border-b px-6 py-4">
              <DialogTitle>Confirm generated orders</DialogTitle>
            </DialogHeader>
            {orderEditorContent}
            {orderEditorFooter}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={isOrderSheetOpen} onOpenChange={onOrderSheetOpenChange}>
          <SheetContent side="bottom" className="mx-1 flex h-[80vh] flex-col rounded-t-4xl p-0">
            <SheetHeader className="border-border border-b px-6 py-4">
              <SheetTitle>Confirm generated orders</SheetTitle>
            </SheetHeader>
            {orderEditorContent}
            {orderEditorFooter}
          </SheetContent>
        </Sheet>
      )}
      {isDesktopViewport ? (
        <Dialog
          open={isDeployRecordSheetOpen}
          onOpenChange={(open) => {
            setIsDeployRecordSheetOpen(open);
            if (!open) {
              setSelectedDeployRecord(null);
            }
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-lg">
            <DialogHeader className="border-border border-b px-6 py-4">
              <DialogTitle>Deploy record details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 overflow-auto px-6 pt-4 pb-6 text-sm">
              {selectedDeployRecord ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{formatRecordTime(selectedDeployRecord.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ticker</span>
                    <span className="font-medium">{selectedDeployRecord.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Action</span>
                    <Badge variant={selectedDeployRecord.action === "SELL" ? "destructive" : "success"}>
                      {selectedDeployRecord.action}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-medium">{selectedDeployRecord.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span className="font-medium">{selectedDeployRecord.periodIndex}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">
                      {formatCurrency(selectedDeployRecord.amount, selectedDeployRecord.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{selectedDeployRecord.quantity.toFixed(8)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-medium">
                      {formatCurrency(selectedDeployRecord.unitPrice, selectedDeployRecord.currency)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Select a record to see details.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet
          open={isDeployRecordSheetOpen}
          onOpenChange={(open) => {
            setIsDeployRecordSheetOpen(open);
            if (!open) {
              setSelectedDeployRecord(null);
            }
          }}
        >
          <SheetContent side="bottom" className="rounded-t-4xl mx-1 h-[75vh] p-0">
            <SheetHeader className="border-border border-b px-6 py-4">
              <SheetTitle>Deploy record details</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 overflow-auto px-6 pt-4 pb-20 text-sm">
              {selectedDeployRecord ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{formatRecordTime(selectedDeployRecord.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ticker</span>
                    <span className="font-medium">{selectedDeployRecord.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Action</span>
                    <Badge variant={selectedDeployRecord.action === "SELL" ? "destructive" : "success"}>
                      {selectedDeployRecord.action}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-medium">{selectedDeployRecord.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span className="font-medium">{selectedDeployRecord.periodIndex}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">
                      {formatCurrency(selectedDeployRecord.amount, selectedDeployRecord.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{selectedDeployRecord.quantity.toFixed(8)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-medium">
                      {formatCurrency(selectedDeployRecord.unitPrice, selectedDeployRecord.currency)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Select a record to see details.</p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Page>
  );
}
