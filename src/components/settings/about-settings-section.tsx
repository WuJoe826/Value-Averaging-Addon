import React from "react";
import type { ValueAveragingSettings } from "../../types";
import { AboutSettingsContent } from "./about-settings-content";

export interface AboutSettingsSectionProps {
  layout: "desktop" | "mobile";
  draft: ValueAveragingSettings;
  title: string;
  description: string;
}

export function AboutSettingsSection({ layout, draft, title, description }: AboutSettingsSectionProps) {
  const content = <AboutSettingsContent draft={draft} />;

  if (layout === "mobile") {
    return content;
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
