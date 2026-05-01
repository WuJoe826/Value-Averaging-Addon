import { Icons } from "@wealthfolio/ui";
import React from "react";
import { GENERAL_PAGE_DESCRIPTION } from "../components";

export type PreferenceSection = "general" | "portfolio" | "about";
export type MobileView = "menu" | "detail";

export interface SettingsNavItem {
  key: PreferenceSection;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

export interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

export const SETTINGS_SECTIONS: SettingsNavSection[] = [
  {
    title: "Preferences",
    items: [
      {
        key: "general" as const,
        title: "General",
        subtitle: "Top-up strategy and growth schedule",
        icon: <Icons.Settings className="size-5" />,
      },
      {
        key: "portfolio" as const,
        title: "Portfolio",
        subtitle: "Ticker selection and allocations",
        icon: <Icons.PieChart className="size-5" />,
      },
    ],
  },
  {
    title: "About",
    items: [
      {
        key: "about" as const,
        title: "About",
        subtitle: "Addon information and status",
        icon: <Icons.InfoCircle className="size-5" />,
      },
    ],
  },
];

export function getSectionMeta(section: PreferenceSection): { title: string; description: string } {
  if (section === "general") {
    return {
      title: "General",
      description: GENERAL_PAGE_DESCRIPTION,
    };
  }
  if (section === "portfolio") {
    return {
      title: "Portfolio",
      description: "Select tickers and assign allocation percentages for value averaging.",
    };
  }
  return {
    title: "About",
    description: "Basic information and current status of your value averaging setup.",
  };
}
