import { Icons } from "@wealthfolio/ui";
import React from "react";
import type { PreferenceSection, SettingsNavItem, SettingsNavSection } from "./settings-nav-config";
import { getSectionMeta } from "./settings-nav-config";

export interface SettingsPageMobileProps {
  sections: SettingsNavSection[];
  mobileView: "menu" | "detail";
  onMobileViewChange: (view: "menu" | "detail") => void;
  activeSection: PreferenceSection;
  onSelectSection: (section: PreferenceSection) => void;
  activeNavItem: SettingsNavItem | undefined;
  detailContent: React.ReactNode;
}

export function SettingsPageMobile({
  sections,
  mobileView,
  onMobileViewChange,
  activeSection,
  onSelectSection,
  activeNavItem,
  detailContent,
}: SettingsPageMobileProps) {
  const sectionMeta = getSectionMeta(activeSection);

  return (
    <div className="w-full max-w-full lg:hidden">
      {mobileView === "menu" ? (
        <div className="space-y-6 px-3 pt-3 pb-[calc(var(--mobile-nav-ui-height)+max(var(--mobile-nav-gap),env(safe-area-inset-bottom)))]">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="text-muted-foreground px-0 text-xs font-semibold uppercase tracking-widest">
                {section.title}
              </div>
              <div className="divide-border bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectSection(item.key)}
                    className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors active:opacity-90"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="text-muted-foreground shrink-0">{item.icon}</div>
                      <div className="min-w-0">
                        <div className="text-foreground truncate text-base font-medium">{item.title}</div>
                        <div className="text-muted-foreground truncate text-sm">{item.subtitle}</div>
                      </div>
                    </div>
                    <Icons.ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`w-full max-w-full overflow-x-hidden ${activeSection === "general" ? "pt-0" : "pt-safe"}`}
        >
          <div
            className={`px-3 pb-[calc(var(--mobile-nav-ui-height)+max(var(--mobile-nav-gap),env(safe-area-inset-bottom)))] ${
              activeSection === "general"
                ? "space-y-1 pt-0"
                : "space-y-4 pt-2"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onMobileViewChange("menu")}
                className="hover:bg-accent inline-flex h-8 w-8 items-center justify-center"
              >
                <Icons.ArrowLeft className="size-6" />
              </button>
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-bold tracking-tight">
                  {activeNavItem?.title ?? "Section"}
                </h2>
                {activeSection !== "general" && (
                  <p className="text-muted-foreground truncate text-sm">
                    {activeNavItem?.subtitle ?? sectionMeta.description}
                  </p>
                )}
              </div>
            </div>
            {detailContent}
          </div>
        </div>
      )}
    </div>
  );
}
