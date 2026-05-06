import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DatePickerInput,
  Input,
  Label,
  Switch,
} from "@wealthfolio/ui";
import React from "react";
import {
  calculateEndDate,
  clampInstallments,
  formatCurrency,
  GROWTH_INTERVAL_OPTIONS,
  getTodayIsoDate,
  normalizeIsoDate,
} from "../../lib";
import type { ValueAveragingSettings } from "../../types";
import { IntervalInput } from "./interval-input";

const PRESET_MULTIPLIERS = [2, 3, 4, 5, 10] as const;

export interface GeneralSettingsContentProps {
  baseCurrency: string;
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
  isPercentageTopUpAvailable: boolean;
  percentageTopUpPreviewAmount: number;
}

export function GeneralSettingsContent({
  baseCurrency,
  draft,
  setDraft,
  isPercentageTopUpAvailable,
  percentageTopUpPreviewAmount,
}: GeneralSettingsContentProps) {
  const growthSchedule = draft.growthSchedule;
  const calculatedEndDate = calculateEndDate(
    growthSchedule.startDate,
    growthSchedule.interval,
    growthSchedule.installments,
  );
  const startDateValue = growthSchedule.startDate ? new Date(`${growthSchedule.startDate}T00:00:00`) : undefined;
  const calculatedEndDateValue = calculatedEndDate ? new Date(`${calculatedEndDate}T00:00:00`) : undefined;

  const toLocalIsoDate = (value: Date): string => {
    const timezoneOffsetMs = value.getTimezoneOffset() * 60 * 1000;
    return new Date(value.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
  };

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
        <CardContent className="space-y-6 pt-2">
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
                disabled={!isPercentageTopUpAvailable}
                onClick={() => {
                  if (!isPercentageTopUpAvailable) {
                    return;
                  }
                  setDraft((prev) => ({ ...prev, topUpMode: "percentage" }));
                }}
              >
                Percentage
              </Button>
            </div>
            {!isPercentageTopUpAvailable ? (
              <p className="text-muted-foreground text-xs">
                Percentage mode requires at least one enabled holding and total portfolio allocation equal to
                100%.
              </p>
            ) : null}
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
              <p className="text-muted-foreground text-xs">
                Estimated top-up amount: {formatCurrency(percentageTopUpPreviewAmount, baseCurrency)}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Label className="text-base">Overflow Gains</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.overflowGainsAction === "hold-to-next-round" ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, overflowGainsAction: "hold-to-next-round" }))}
              >
                Hold to Next Round
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.overflowGainsAction === "sell" ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, overflowGainsAction: "sell" }))}
              >
                Sell
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label className="text-base">Purchase Unit</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.purchaseUnit === "fractional-unit" ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, purchaseUnit: "fractional-unit" }))}
              >
                Fractional Unit
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.purchaseUnit === "whole-unit" ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, purchaseUnit: "whole-unit" }))}
              >
                Whole Unit
              </Button>
            </div>
          </div>

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
            <div className="flex flex-col gap-3">
              <Label>Multipliers</Label>
              <div className="flex flex-wrap gap-2">
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
            <CardTitle className="text-lg">Growth schedule</CardTitle>
            <CardDescription>
              Define the start date, cadence, and end condition used to derive your value averaging growth path.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="va-growth-start-date">Start date</Label>
            <div id="va-growth-start-date" className="w-full max-w-[360px]">
              <DatePickerInput
                value={startDateValue}
                onChange={(date) => {
                  const nextStartDate = normalizeIsoDate(date ? toLocalIsoDate(date) : getTodayIsoDate());
                  setDraft((prev) => ({
                    ...prev,
                    growthSchedule: {
                      ...prev.growthSchedule,
                      startDate: nextStartDate,
                      endDate: calculateEndDate(
                        nextStartDate,
                        prev.growthSchedule.interval,
                        prev.growthSchedule.installments,
                      ),
                    },
                  }));
                }}
                enableTime={true}
                timeGranularity="minute"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="va-growth-interval">Interval</Label>
            <div className="w-full max-w-[360px]" id="va-growth-interval">
              <IntervalInput
                value={growthSchedule.interval}
                options={GROWTH_INTERVAL_OPTIONS}
                onChange={(nextInterval) =>
                  setDraft((prev) => ({
                    ...prev,
                    growthSchedule: {
                      ...prev.growthSchedule,
                      interval: nextInterval,
                      endDate: calculateEndDate(
                        prev.growthSchedule.startDate,
                        nextInterval,
                        prev.growthSchedule.installments,
                      ),
                    },
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="va-growth-end-date-switch" className="text-base">
                End date
              </Label>
              <p className="text-muted-foreground text-xs">Enable to configure Ending On/After behavior.</p>
            </div>
            <Switch
              id="va-growth-end-date-switch"
              checked={growthSchedule.endDateEnabled}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  growthSchedule: {
                    ...prev.growthSchedule,
                    endDateEnabled: checked,
                  },
                }))
              }
            />
          </div>

          {growthSchedule.endDateEnabled && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <Label>Ending On/After</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={growthSchedule.endingMode === "specific-date" ? "default" : "outline"}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        growthSchedule: { ...prev.growthSchedule, endingMode: "specific-date" },
                      }))
                    }
                  >
                    Specific Date
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={growthSchedule.endingMode === "number-of-installments" ? "default" : "outline"}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        growthSchedule: { ...prev.growthSchedule, endingMode: "number-of-installments" },
                      }))
                    }
                  >
                    Number of Installments
                  </Button>
                </div>
              </div>

              {growthSchedule.endingMode === "specific-date" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="va-growth-end-date">End Date (calculated)</Label>
                  <div id="va-growth-end-date" className="w-full max-w-[360px]">
                    <DatePickerInput
                      value={calculatedEndDateValue}
                      onChange={() => undefined}
                      disabled={true}
                      enableTime={true}
                      timeGranularity="minute"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="va-growth-amounts">Amounts</Label>
                  <Input
                    id="va-growth-amounts"
                    type="number"
                    min={1}
                    max={240}
                    className="w-full max-w-[360px]"
                    value={growthSchedule.installments}
                    onChange={(event) => {
                      const installments = clampInstallments(Number(event.target.value) || 1);
                      setDraft((prev) => ({
                        ...prev,
                        growthSchedule: {
                          ...prev.growthSchedule,
                          installments,
                          endDate: calculateEndDate(
                            prev.growthSchedule.startDate,
                            prev.growthSchedule.interval,
                            installments,
                          ),
                        },
                      }));
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
