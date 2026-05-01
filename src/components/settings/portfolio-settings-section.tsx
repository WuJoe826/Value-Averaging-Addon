import type { AddonContext } from "@wealthfolio/addon-sdk";
import React from "react";
import type { PortfolioTicker, ValueAveragingSettings } from "../../types";
import type { AddonPageTab } from "../page-tab-selector";
import { PortfolioSettingsContent } from "./portfolio-settings-content";

export interface PortfolioSettingsSectionProps {
  layout: "desktop" | "mobile";
  ctx: AddonContext;
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
  tickers: PortfolioTicker[];
  totalAllocation: number;
  isAllocationValid: boolean;
  title: string;
  description: string;
  onReset: () => void;
  onConfirmSettings: (next: ValueAveragingSettings) => void;
  onPageChange: (nextPage: AddonPageTab) => void;
}

export function PortfolioSettingsSection({
  layout,
  ctx,
  draft,
  setDraft,
  tickers,
  totalAllocation,
  isAllocationValid,
  title,
  description,
  onReset,
  onConfirmSettings,
  onPageChange,
}: PortfolioSettingsSectionProps) {
  const content = (
    <PortfolioSettingsContent
      layout={layout}
      draft={draft}
      setDraft={setDraft}
      tickers={tickers}
      totalAllocation={totalAllocation}
      isAllocationValid={isAllocationValid}
      onReset={onReset}
      onConfirm={() => {
        if (!isAllocationValid) {
          return;
        }
        const next = { ...draft, isConfigured: true };
        onConfirmSettings(next);
        onPageChange("dashboard");
        ctx.api.logger.info("Value averaging settings saved");
      }}
    />
  );

  if (layout === "mobile") {
    return (
      <div className="space-y-4">
        <div className="border-border border-b" />
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="border-border border-b" />
      {content}
    </div>
  );
}
