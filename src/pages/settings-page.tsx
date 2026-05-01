import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Card,
  CardContent,
  Icons,
  Page,
  PageContent,
  PageHeader,
} from "@wealthfolio/ui";
import React, { useMemo, useState } from "react";
import {
  AboutSettingsContent,
  GeneralSettingsContent,
  PageTabSelector,
  PortfolioSettingsContent,
  type AddonPageTab,
} from "../components";
import type { PortfolioTicker, ValueAveragingSettings } from "../types";

interface SettingsPageProps {
  ctx: AddonContext;
  currentPage: AddonPageTab;
  onPageChange: (nextPage: AddonPageTab) => void;
  settings: ValueAveragingSettings;
  tickers: PortfolioTicker[];
  onConfirmSettings: (nextSettings: ValueAveragingSettings) => void;
}
type PreferenceSection = "general" | "portfolio" | "about";
type MobileView = "menu" | "detail";

interface SettingsNavItem {
  key: PreferenceSection;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

const SETTINGS_SECTIONS: SettingsNavSection[] = [
  {
    title: "Preferences",
    items: [
      {
        key: "general" as const,
        title: "General",
        subtitle: "Top-up strategy and growth period",
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

function getSectionMeta(section: PreferenceSection): { title: string; description: string } {
  if (section === "general") {
    return {
      title: "General",
      description: "Configure top-up logic, risk limits, and growth period notifications.",
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

export default function SettingsPage({
  ctx,
  currentPage,
  onPageChange,
  settings,
  tickers,
  onConfirmSettings,
}: SettingsPageProps) {
  const [draft, setDraft] = useState<ValueAveragingSettings>(settings);
  const [activeSection, setActiveSection] = useState<PreferenceSection>("general");
  const [mobileView, setMobileView] = useState<MobileView>("menu");

  const allNavItems = SETTINGS_SECTIONS.flatMap((section) => section.items);
  const activeNavItem = allNavItems.find((item) => item.key === activeSection);
  const sectionMeta = getSectionMeta(activeSection);
  const totalAllocation = useMemo(
    () =>
      tickers
        .filter((ticker) => draft.enabledTickers[ticker.id])
        .reduce((total, ticker) => total + (draft.tickerAllocations[ticker.id] ?? 0), 0),
    [draft, tickers],
  );

  const headerActions = <PageTabSelector currentPage={currentPage} onPageChange={onPageChange} />;
  const selectSection = (section: PreferenceSection, isMobile: boolean) => {
    setActiveSection(section);
    if (isMobile) {
      setMobileView("detail");
    }
  };

  const renderSectionContent = () => {
    if (activeSection === "general") {
      return <GeneralSettingsContent draft={draft} setDraft={setDraft} />;
    }

    if (activeSection === "portfolio") {
      return (
        <PortfolioSettingsContent
          draft={draft}
          setDraft={setDraft}
          tickers={tickers}
          totalAllocation={totalAllocation}
          onConfirm={() => {
            const next = { ...draft, isConfigured: true };
            onConfirmSettings(next);
            onPageChange("dashboard");
            ctx.api.logger.info("Value averaging settings confirmed");
          }}
        />
      );
    }

    return <AboutSettingsContent draft={draft} />;
  };

  return (
    <Page>
      <PageHeader heading="Value Averaging" actions={headerActions} />
      <PageContent>
        <div className="hidden lg:flex lg:w-full lg:justify-start">
          <div className="flex w-full max-w-6xl flex-col px-0 py-8">
            <div className="space-y-0.5">
              <h2 className="text-2xl font-bold tracking-tight">Value Averaging</h2>
            </div>
            <div className="my-6 border-border border-b" />
            <div className="flex gap-10">
              <aside className="hidden w-[240px] shrink-0 lg:sticky lg:top-24 lg:flex lg:flex-col lg:self-start">
                <div className="space-y-6">
                  {SETTINGS_SECTIONS.map((section) => (
                    <div key={section.title} className="space-y-2">
                      <div className="text-muted-foreground pl-2 text-sm font-light uppercase tracking-widest">
                        {section.title}
                      </div>
                      <nav className="flex flex-col space-y-1">
                        {section.items.map((item) => {
                          const isActive = activeSection === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => selectSection(item.key, false)}
                              className={`inline-flex h-9 w-full items-center justify-start gap-2 rounded-md px-2 text-left text-sm ${
                                isActive
                                  ? "bg-muted hover:bg-muted"
                                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                            >
                              <span className="inline-flex items-center justify-center [&_svg]:size-4">
                                {item.icon}
                              </span>
                              <span>{item.title}</span>
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="mb-8 min-w-0 flex-1">
                <div className="w-full max-w-4xl space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight">{sectionMeta.title}</h2>
                    <p className="text-muted-foreground text-sm">{sectionMeta.description}</p>
                  </div>
                  <div className="border-border border-b" />
                  {renderSectionContent()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:hidden">
          {mobileView === "menu" ? (
            <div className="space-y-6 px-1 py-3">
              {SETTINGS_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-3">
                  <div className="text-muted-foreground px-2 text-xs font-semibold uppercase tracking-widest">
                    {section.title}
                  </div>
                  <div className="divide-border bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
                    {section.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => selectSection(item.key, true)}
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
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileView("menu")}
                  className="hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded-md border"
                >
                  <Icons.ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight">{activeNavItem?.title ?? "Section"}</h2>
                  <p className="text-muted-foreground truncate text-sm">
                    {activeNavItem?.subtitle ?? sectionMeta.description}
                  </p>
                </div>
              </div>
              {renderSectionContent()}
            </div>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
