import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from "@wealthfolio/ui";
import React from "react";
import type { PortfolioTicker, ValueAveragingSettings } from "../types";

const PRESET_MULTIPLIERS = [2, 3, 4, 5] as const;

function InfinityGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4z" />
    </svg>
  );
}

interface GeneralSettingsContentProps {
  baseCurrency: string;
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
}

export function GeneralSettingsContent({ baseCurrency, draft, setDraft }: GeneralSettingsContentProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg">Top-Up</CardTitle>
            <CardDescription>
              Choose whether each cycle uses a fixed currency amount or a percentage of your plan, and
              optionally cap how large a single top-up can grow during sharp drawdowns.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3">
            <Label className="text-base">Top-up mode</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.topUpMode === "amount" ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, topUpMode: "amount" }))}
              >
                Fixed amount
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.topUpMode === "percentage" ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, topUpMode: "percentage" }))}
              >
                Percentage
              </Button>
            </div>
          </div>

          {draft.topUpMode === "amount" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="va-top-up-amount">Top-up amount ({baseCurrency})</Label>
              <Input
                id="va-top-up-amount"
                type="number"
                min={0}
                className="w-full max-w-[360px]"
                value={draft.topUpAmount}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    topUpAmount: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="va-top-up-pct">Top-up percentage (%)</Label>
              <Input
                id="va-top-up-pct"
                type="number"
                min={0}
                max={100}
                className="w-full max-w-[360px]"
                value={draft.topUpPercentage}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    topUpPercentage: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                  }))
                }
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="va-max-top-up" className="text-base">
                Enable maximum top-up amount
              </Label>
              <p className="text-muted-foreground text-xs">
                When the market drops heavily, limit how large a single top-up can be relative to your base
                plan, or choose no limit.
              </p>
            </div>
            <Switch
              id="va-max-top-up"
              checked={draft.maxTopUpEnabled}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, maxTopUpEnabled: checked }))}
              className="shrink-0"
            />
          </div>

          {draft.maxTopUpEnabled && (
            <div className="space-y-3">
              <Label>Multipliers</Label>
              <div className="flex flex-wrap gap-2">
              <Button
                  type="button"
                  size="sm"
                  variant={draft.maxTopUpMultiplier === null ? "default" : "outline"}
                  onClick={() => setDraft((prev) => ({ ...prev, maxTopUpMultiplier: null }))}
                  className="gap-1.5"
                  aria-label="No limit"
                >
                  <InfinityGlyph />
                </Button>
                {PRESET_MULTIPLIERS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={draft.maxTopUpMultiplier === value ? "default" : "outline"}
                    onClick={() => setDraft((prev) => ({ ...prev, maxTopUpMultiplier: value }))}
                  >
                    {value}x
                  </Button>
                ))}
                
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg">Growth period</CardTitle>
            <CardDescription>
              Set the number of months over which you expect the value averaging path to grow—used for
              scheduling reminders and notification context.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="va-growth-months">Months (for notification)</Label>
            <Input
              id="va-growth-months"
              type="number"
              min={1}
              max={240}
              className="w-full max-w-[360px]"
              value={draft.growthPeriodMonths}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  growthPeriodMonths: Math.min(240, Math.max(1, Number(event.target.value) || 1)),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

interface PortfolioSettingsContentProps {
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

interface AboutSettingsContentProps {
  draft: ValueAveragingSettings;
}

export function AboutSettingsContent({ draft }: AboutSettingsContentProps) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-sm">
        <p>
          Value Averaging addon helps you set a growth path and calculate top-up amounts based on current
          prices and your portfolio allocation.
        </p>
        <div className="rounded-md border p-3">
          <div className="font-medium">Current status</div>
          <div className="text-muted-foreground mt-1 text-xs">
            Configuration: {draft.isConfigured ? "Configured" : "Not configured"}
          </div>
          <div className="text-muted-foreground text-xs">
            Top-up mode: {draft.topUpMode === "amount" ? "Fixed amount" : "Percentage"}
          </div>
          <div className="text-muted-foreground text-xs">
            Growth period: {draft.growthPeriodMonths} months
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Tip: Set your General and Portfolio sections first, then confirm settings in Portfolio.
        </p>
      </CardContent>
    </Card>
  );
}
