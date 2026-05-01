import { Card, CardContent } from "@wealthfolio/ui";
import React from "react";
import type { PortfolioTicker, ValueAveragingSettings } from "../types";

const PRESET_MULTIPLIERS = [1.5, 2, 3, 4, 5];

interface GeneralSettingsContentProps {
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
}

export function GeneralSettingsContent({ draft, setDraft }: GeneralSettingsContentProps) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-sm">
        <div className="space-y-2">
          <div className="font-medium">Top-up mode</div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`inline-flex h-9 items-center rounded-md border px-3 ${
                draft.topUpMode === "amount" ? "bg-primary text-primary-foreground" : ""
              }`}
              onClick={() => setDraft((prev) => ({ ...prev, topUpMode: "amount" }))}
            >
              Fixed amount
            </button>
            <button
              type="button"
              className={`inline-flex h-9 items-center rounded-md border px-3 ${
                draft.topUpMode === "percentage" ? "bg-primary text-primary-foreground" : ""
              }`}
              onClick={() => setDraft((prev) => ({ ...prev, topUpMode: "percentage" }))}
            >
              Percentage
            </button>
          </div>
        </div>

        {draft.topUpMode === "amount" ? (
          <label className="block space-y-1">
            <span className="font-medium">Top-up amount (USD)</span>
            <input
              type="number"
              min={0}
              value={draft.topUpAmount}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  topUpAmount: Math.max(0, Number(event.target.value) || 0),
                }))
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3"
            />
          </label>
        ) : (
          <label className="block space-y-1">
            <span className="font-medium">Top-up percentage (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.topUpPercentage}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  topUpPercentage: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                }))
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3"
            />
          </label>
        )}

        <label className="flex items-center justify-between rounded-md border px-3 py-2">
          <span>Enable maximum top-up amount</span>
          <input
            type="checkbox"
            checked={draft.maxTopUpEnabled}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, maxTopUpEnabled: event.target.checked }))
            }
            className="h-4 w-4"
          />
        </label>

        {draft.maxTopUpEnabled && (
          <div className="space-y-3">
            <div>
              <div className="mb-2 font-medium">Preset multipliers</div>
              <div className="flex flex-wrap gap-2">
                {PRESET_MULTIPLIERS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, maxTopUpMultiplier: value }))}
                    className={`inline-flex h-8 items-center rounded-md border px-2.5 ${
                      draft.maxTopUpMultiplier === value ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {value}x
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-2">
              <span className="font-medium">Custom multiplier: {draft.maxTopUpMultiplier.toFixed(1)}x</span>
              <input
                type="range"
                min={1}
                max={10}
                step={0.1}
                value={draft.maxTopUpMultiplier}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    maxTopUpMultiplier: Number(event.target.value),
                  }))
                }
                className="w-full"
              />
            </label>
          </div>
        )}

        <label className="block space-y-1">
          <span className="font-medium">Growth period (months, for notification)</span>
          <input
            type="number"
            min={1}
            max={240}
            value={draft.growthPeriodMonths}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                growthPeriodMonths: Math.min(240, Math.max(1, Number(event.target.value) || 1)),
              }))
            }
            className="border-input bg-background h-9 w-full rounded-md border px-3"
          />
        </label>
      </CardContent>
    </Card>
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
