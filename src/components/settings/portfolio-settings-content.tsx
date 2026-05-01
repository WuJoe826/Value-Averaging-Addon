import {
  Button,
  EmptyPlaceholder,
  Icons,
  Input,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@wealthfolio/ui";
import React, { useMemo, useState } from "react";
import type { PortfolioTicker, ValueAveragingSettings } from "../../types";

export interface PortfolioSettingsContentProps {
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
  tickers: PortfolioTicker[];
  totalAllocation: number;
  onConfirm: () => void;
}

type FilterType = "all" | "enabled" | "disabled";

export function PortfolioSettingsContent({
  draft,
  setDraft,
  tickers,
  totalAllocation,
  onConfirm,
}: PortfolioSettingsContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredTickers = useMemo(() => {
    let result = tickers;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (ticker) =>
          ticker.symbol.toLowerCase().includes(query) ||
          ticker.name.toLowerCase().includes(query) ||
          ticker.accountName.toLowerCase().includes(query),
      );
    }

    if (filter === "enabled") {
      result = result.filter((ticker) => draft.enabledTickers[ticker.id]);
    }
    if (filter === "disabled") {
      result = result.filter((ticker) => !draft.enabledTickers[ticker.id]);
    }
    return result;
  }, [draft.enabledTickers, filter, searchQuery, tickers]);

  const enabledTickers = filteredTickers.filter((ticker) => draft.enabledTickers[ticker.id]);
  const disabledTickers = filteredTickers.filter((ticker) => !draft.enabledTickers[ticker.id]);

  const renderTickerItem = (ticker: PortfolioTicker) => {
    const enabled = draft.enabledTickers[ticker.id];
    return (
      <div key={ticker.id} className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
              <Icons.Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {ticker.symbol} - {ticker.name}
              </div>
              <div className="text-muted-foreground truncate text-xs">{ticker.accountName}</div>
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${enabled ? "text-success" : "text-muted-foreground"}`}
            >
              {enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  enabledTickers: {
                    ...prev.enabledTickers,
                    [ticker.id]: checked,
                  },
                }))
              }
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-muted-foreground block text-xs">
            Allocation in value averaging portfolio (%)
          </label>
          <Input
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
            className="h-9 max-w-[360px]"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-6 text-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Icons.Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search tickers..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 pl-9 pr-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                aria-label="Clear search"
              >
                <Icons.Close className="h-4 w-4" />
              </button>
            )}
          </div>

          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => value && setFilter(value as FilterType)}
            className="bg-muted h-9 rounded-md p-1"
          >
            <ToggleGroupItem value="all" className="data-[state=on]:bg-background h-7 rounded px-3 text-xs">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="enabled" className="data-[state=on]:bg-background h-7 rounded px-3 text-xs">
              Enabled
            </ToggleGroupItem>
            <ToggleGroupItem value="disabled" className="data-[state=on]:bg-background h-7 rounded px-3 text-xs">
              Disabled
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {filteredTickers.length === 0 ? (
          <EmptyPlaceholder>
            <EmptyPlaceholder.Icon name="PieChart" />
            <EmptyPlaceholder.Title>No ticker match</EmptyPlaceholder.Title>
            <EmptyPlaceholder.Description>
              No ticker matches your current search or filter.
            </EmptyPlaceholder.Description>
          </EmptyPlaceholder>
        ) : filter === "all" ? (
          <div className="space-y-6">
            {enabledTickers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-muted-foreground text-sm font-medium">Enabled Tickers</h3>
                  <span className="text-success rounded-full px-2 py-0.5 text-xs font-medium">
                    {enabledTickers.length}
                  </span>
                </div>
                <div className="bg-card divide-border divide-y rounded-md border">
                  {enabledTickers.map(renderTickerItem)}
                </div>
              </div>
            )}

            {disabledTickers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-muted-foreground text-sm font-medium">Disabled Tickers</h3>
                  <span className="text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    {disabledTickers.length}
                  </span>
                </div>
                <div className="bg-card divide-border divide-y rounded-md border">
                  {disabledTickers.map(renderTickerItem)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card divide-border divide-y rounded-md border">{filteredTickers.map(renderTickerItem)}</div>
        )}

        <div className="rounded-md px-3 py-2 text-xs">
          Enabled allocation total: {totalAllocation.toFixed(2)}%
        </div>

        <Button type="button" onClick={onConfirm} className="h-10 w-full">
          Confirm settings
        </Button>
    </div>
  );
}
