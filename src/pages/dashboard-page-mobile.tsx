import { Avatar, AvatarFallback, AvatarImage, Badge, Icons, Sheet, SheetContent, SheetHeader, SheetTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@wealthfolio/ui";
import React from "react";
import { formatCurrency } from "../lib";
import type { PortfolioTicker } from "../types";

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

interface DashboardPageMobileProps {
  baseCurrency: string;
  enabledTickers: PortfolioTicker[];
  investmentPlan: Record<string, InvestmentPlan>;
  expectedWeightByTicker: Record<string, number>;
  actualWeightByTicker: Record<string, number>;
  selectedTicker: PortfolioTicker | null;
  selectedPlan: InvestmentPlan | null;
  onSelectTicker: (tickerId: string) => void;
  isTickerDetailSheetOpen: boolean;
  onTickerDetailSheetOpenChange: (open: boolean) => void;
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

export function DashboardPageMobile({
  baseCurrency,
  enabledTickers,
  investmentPlan,
  expectedWeightByTicker,
  actualWeightByTicker,
  selectedTicker,
  selectedPlan,
  onSelectTicker,
  isTickerDetailSheetOpen,
  onTickerDetailSheetOpenChange,
}: DashboardPageMobileProps) {
  const selectedQuantity = toFiniteNumber(selectedTicker?.quantity);
  const selectedCurrentPrice = toFiniteNumber(selectedTicker?.currentPrice);
  const selectedVaCostBasis = toFiniteNumber(selectedTicker?.totalInvested);
  const selectedVaAverageCost =
    selectedQuantity > 0 ? selectedVaCostBasis / selectedQuantity : toFiniteNumber(selectedTicker?.averageCost);
  const selectedMarketValue = selectedCurrentPrice * selectedQuantity;
  const selectedExpectedWeight = selectedTicker ? expectedWeightByTicker[selectedTicker.id] ?? 0 : 0;
  const selectedActualWeight = selectedTicker ? actualWeightByTicker[selectedTicker.id] ?? 0 : 0;
  const selectedAmountSign = selectedPlan?.action === "sell" ? "-" : "+";
  const selectedSignedSharesLabel =
    selectedCurrentPrice > 0 && selectedPlan && selectedPlan.action !== "hold"
      ? `${selectedAmountSign}${formatShareCount(Math.abs(selectedPlan.amountToInvest) / selectedCurrentPrice)} Shares`
      : "--.--";

  return (
    <div className="sm:hidden">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader className="bg-muted-foreground/5 sticky top-0 z-10">
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Amount to invest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enabledTickers.map((ticker) => {
              const plan = investmentPlan[ticker.id];
              const currentPrice = toFiniteNumber(ticker.currentPrice);
              const amountSign = plan?.action === "sell" ? "-" : "+";
              const signedAmountLabel =
                plan && plan.action !== "hold"
                  ? `${amountSign}${formatCurrency(Math.abs(plan.amountToInvest), baseCurrency)}`
                  : `${baseCurrency} --.--`;
              const signedSharesLabel =
                currentPrice > 0 && plan && plan.action !== "hold"
                  ? `${amountSign}${formatShareCount(Math.abs(plan.amountToInvest) / currentPrice)} Shares`
                  : "--.--";

              return (
                <TableRow
                  key={ticker.id}
                  className="cursor-pointer"
                  onClick={() => {
                    onSelectTicker(ticker.id);
                    onTickerDetailSheetOpenChange(true);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 text-left">
                      <TickerLogo symbol={ticker.symbol} />
                      <div>
                        <div className="font-medium">{ticker.symbol}</div>
                        <div className="text-muted-foreground text-xs">
                          {formatShareCount(toFiniteNumber(ticker.quantity))} shares
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex flex-col items-end">
                      {plan?.action === "hold" ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          {baseCurrency} --.--
                        </Badge>
                      ) : plan && plan.amountToInvest < 0 ? (
                        <Badge variant="destructive">{signedAmountLabel}</Badge>
                      ) : (
                        <Badge variant="success">{signedAmountLabel}</Badge>
                      )}
                      <div className="text-muted-foreground mt-1 text-right text-xs leading-tight">{signedSharesLabel}</div>
                      </div>
                      <Icons.ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={isTickerDetailSheetOpen} onOpenChange={onTickerDetailSheetOpenChange}>
        <SheetContent side="bottom" className="rounded-t-4xl mx-1 h-[75vh] p-0">
          <SheetHeader className="border-border border-b px-6 py-4">
            <SheetTitle>Ticker details</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 overflow-auto px-6 pt-4 pb-20 text-sm">
            {selectedTicker && selectedPlan ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ticker</span>
                  <span className="font-medium">{selectedTicker.symbol}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ticker shares</span>
                  <span className="font-medium">{formatShareCount(selectedQuantity)} shares</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-medium">{selectedTicker.accountName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Allocation</span>
                  <span className="font-medium">{selectedActualWeight.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expected allocation</span>
                  <span className="font-medium">{selectedExpectedWeight.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cost basis</span>
                  <span className="font-medium">{formatCurrency(selectedVaCostBasis, baseCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Average cost</span>
                  <span className="font-medium">{formatCurrency(selectedVaAverageCost, baseCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Market value</span>
                  <span className="font-medium">{formatCurrency(selectedMarketValue, baseCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current price</span>
                  <span className="font-medium">{formatCurrency(selectedCurrentPrice, baseCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Desired value</span>
                  <span className="font-medium">{formatCurrency(selectedPlan.targetValue, baseCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Growth per period</span>
                  <span className="font-medium">
                    {formatCurrency(selectedPlan.growthPerPeriod, baseCurrency)} x {selectedPlan.periodIndex}
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
                      -{formatCurrency(Math.abs(selectedPlan.amountToInvest), baseCurrency)}
                    </Badge>
                  ) : (
                    <Badge variant="success">+{formatCurrency(selectedPlan.amountToInvest, baseCurrency)}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shares change</span>
                  <span className="font-medium">{selectedSignedSharesLabel}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Select a ticker to see details.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
