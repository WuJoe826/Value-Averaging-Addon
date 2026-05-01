import React from "react";
import type { ValueAveragingSettings } from "../../types";
import { GeneralSettingsContent } from "./general-settings-content";

export const GENERAL_PAGE_DESCRIPTION =
  "Configure top-up logic, risk limits, and growth period notifications.";

export interface GeneralSettingsSectionProps {
  layout: "desktop" | "mobile";
  baseCurrency: string;
  draft: ValueAveragingSettings;
  setDraft: React.Dispatch<React.SetStateAction<ValueAveragingSettings>>;
}

/** General settings: same vertical rhythm as Portfolio / About (`space-y-4`, title block, bottom border). */
export function GeneralSettingsSection({
  layout,
  baseCurrency,
  draft,
  setDraft,
}: GeneralSettingsSectionProps) {
  const content = <GeneralSettingsContent baseCurrency={baseCurrency} draft={draft} setDraft={setDraft} />;

  if (layout === "mobile") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground break-words text-sm">{GENERAL_PAGE_DESCRIPTION}</p>
        <div className="border-border border-b" />
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">General</h2>
        <p className="text-muted-foreground text-sm">{GENERAL_PAGE_DESCRIPTION}</p>
      </div>
      <div className="border-border border-b" />
      {content}
    </div>
  );
}
