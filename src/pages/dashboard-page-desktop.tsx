import { Avatar, AvatarFallback, AvatarImage, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@wealthfolio/ui";
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

interface DashboardPageDesktopProps {
  baseCurrency: string;
  enabledTickers: PortfolioTicker[];
  investmentPlan: Record<string, InvestmentPlan>;
  expectedWeightByTicker: Record<string, number>;
  actualWeightByTicker: Record<string, number>;
  selectedTickerId: string | null;
  onSelectTicker: (tickerId: string) => void;
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

export function DashboardPageDesktop({
  baseCurrency,
  enabledTickers,
  investmentPlan,
  expectedWeightByTicker,
  actualWeightByTicker,
  selectedTickerId,
  onSelectTicker,
}: DashboardPageDesktopProps) {
  return (
    <div className="hidden sm:block">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader className="bg-muted-foreground/5 sticky top-0 z-10">
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Allocation</TableHead>
              <TableHead>Cost basis</TableHead>
              <TableHead>Market value</TableHead>
              <TableHead>Desired Value</TableHead>
              <TableHead className="text-right">Amount to invest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enabledTickers.map((ticker) => {
              const plan = investmentPlan[ticker.id];
              const quantity = toFiniteNumber(ticker.quantity);
              const vaCostBasis = toFiniteNumber(ticker.totalInvested);
              const vaAverageCost = quantity > 0 ? vaCostBasis / quantity : toFiniteNumber(ticker.averageCost);
              const currentPrice = toFiniteNumber(ticker.currentPrice);
              const marketValue = currentPrice * quantity;
              const expectedWeight = expectedWeightByTicker[ticker.id] ?? 0;
              const actualWeight = actualWeightByTicker[ticker.id] ?? 0;
              const isSelected = selectedTickerId === ticker.id;
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
                  className={isSelected ? "bg-muted/50 cursor-pointer" : "cursor-pointer"}
                  onClick={() => onSelectTicker(ticker.id)}
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
                  <TableCell className="font-medium">
                    <div>{actualWeight.toFixed(2)}%</div>
                    <div className="text-muted-foreground text-xs">Expected {expectedWeight.toFixed(2)}%</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(vaCostBasis, baseCurrency)}</div>
                    <div className="text-muted-foreground text-xs">{formatCurrency(vaAverageCost, baseCurrency)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(marketValue, baseCurrency)}</div>
                    <div className="text-muted-foreground text-xs">{formatCurrency(currentPrice, baseCurrency)}</div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{formatCurrency(plan?.targetValue ?? 0, baseCurrency)}</div>
                    <div className="text-muted-foreground text-xs">
                      {formatCurrency(plan?.growthPerPeriod ?? 0, baseCurrency)} x {plan?.periodIndex ?? 1}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
