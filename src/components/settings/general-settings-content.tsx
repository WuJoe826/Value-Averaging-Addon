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
import type { ValueAveragingSettings } from "../../types";
import { InfinityGlyph } from "./infinity-glyph";

const PRESET_MULTIPLIERS = [2, 3, 4, 5] as const;

export interface GeneralSettingsContentProps {
  baseCurrency: string;
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
}

export function GeneralSettingsContent({ baseCurrency, draft, setDraft }: GeneralSettingsContentProps) {
  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}
