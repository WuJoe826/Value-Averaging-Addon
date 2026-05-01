import { Card, CardContent } from "@wealthfolio/ui";
import React from "react";
import type { ValueAveragingSettings } from "../../types";

export interface AboutSettingsContentProps {
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
