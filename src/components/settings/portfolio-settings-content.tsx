import { Card, CardContent } from "@wealthfolio/ui";
import React from "react";
import type { PortfolioTicker, ValueAveragingSettings } from "../../types";

export interface PortfolioSettingsContentProps {
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
  tickers: PortfolioTicker[];
  totalAllocation: number;
  onConfirm: () => void;
}

export function PortfolioSettingsContent({
  draft,
  setDraft,
  tickers,
  totalAllocation,
  onConfirm,
}: PortfolioSettingsContentProps) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm">
        {tickers.map((ticker) => {
          const enabled = draft.enabledTickers[ticker.id];
          return (
            <div key={ticker.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {ticker.symbol} - {ticker.name}
                  </div>
                  <div className="text-muted-foreground text-xs">{ticker.accountName}</div>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-xs">Enable</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        enabledTickers: {
                          ...prev.enabledTickers,
                          [ticker.id]: event.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-muted-foreground text-xs">
                  Allocation in value averaging portfolio (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={!enabled}
                  value={draft.tickerAllocations[ticker.id] ?? 0}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      tickerAllocations: {
                        ...prev.tickerAllocations,
                        [ticker.id]: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                      },
                    }))
                  }
                  className="border-input bg-background disabled:bg-muted h-9 w-full rounded-md border px-3"
                />
              </label>
            </div>
          );
        })}

        <div className="bg-muted rounded-md px-3 py-2 text-xs">
          Enabled allocation total: {totalAllocation.toFixed(2)}%
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-medium"
        >
          Confirm settings
        </button>
      </CardContent>
    </Card>
  );
}
