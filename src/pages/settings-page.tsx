import type { AddonContext } from "@wealthfolio/addon-sdk";
import { Page, PageContent, PageHeader } from "@wealthfolio/ui";
import React, { useMemo, useState } from "react";
import {
  AboutSettingsSection,
  GeneralSettingsSection,
  PageTabSelector,
  PortfolioSettingsSection,
  type AddonPageTab,
} from "../components";
import type { PortfolioTicker, ValueAveragingSettings } from "../types";
import { SETTINGS_SECTIONS, getSectionMeta, type MobileView, type PreferenceSection } from "./settings-nav-config";
import { SettingsPageDesktop } from "./settings-page-desktop";
import { SettingsPageMobile } from "./settings-page-mobile";

interface SettingsPageProps {
  ctx: AddonContext;
  baseCurrency: string;
  currentPage: AddonPageTab;
  onPageChange: (nextPage: AddonPageTab) => void;
  settings: ValueAveragingSettings;
  tickers: PortfolioTicker[];
  onConfirmSettings: (nextSettings: ValueAveragingSettings) => void;
}

export default function SettingsPage({
  ctx,
  baseCurrency,
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

  const selectSectionDesktop = (section: PreferenceSection) => {
    setActiveSection(section);
  };

  const selectSectionMobile = (section: PreferenceSection) => {
    setActiveSection(section);
    setMobileView("detail");
  };

  const renderDesktopBody = () => {
    if (activeSection === "general") {
      return (
        <GeneralSettingsSection
          layout="desktop"
          baseCurrency={baseCurrency}
          draft={draft}
          setDraft={setDraft}
        />
      );
    }
    if (activeSection === "portfolio") {
      return (
        <PortfolioSettingsSection
          layout="desktop"
          ctx={ctx}
          draft={draft}
          setDraft={setDraft}
          tickers={tickers}
          totalAllocation={totalAllocation}
          title={sectionMeta.title}
          description={sectionMeta.description}
          onConfirmSettings={onConfirmSettings}
          onPageChange={onPageChange}
        />
      );
    }
    return (
      <AboutSettingsSection
        layout="desktop"
        draft={draft}
        title={sectionMeta.title}
        description={sectionMeta.description}
      />
    );
  };

  const renderMobileDetailBody = () => {
    if (activeSection === "general") {
      return (
        <GeneralSettingsSection
          layout="mobile"
          baseCurrency={baseCurrency}
          draft={draft}
          setDraft={setDraft}
        />
      );
    }
    if (activeSection === "portfolio") {
      return (
        <PortfolioSettingsSection
          layout="mobile"
          ctx={ctx}
          draft={draft}
          setDraft={setDraft}
          tickers={tickers}
          totalAllocation={totalAllocation}
          title={sectionMeta.title}
          description={sectionMeta.description}
          onConfirmSettings={onConfirmSettings}
          onPageChange={onPageChange}
        />
      );
    }
    return (
      <AboutSettingsSection
        layout="mobile"
        draft={draft}
        title={sectionMeta.title}
        description={sectionMeta.description}
      />
    );
  };

  return (
    <Page>
      <PageHeader heading="Value Averaging" actions={headerActions} />
      <PageContent withPadding={false} containerMode>
        <div className="w-full min-w-0">
          <SettingsPageDesktop
            sections={SETTINGS_SECTIONS}
            activeSection={activeSection}
            onSelectSection={selectSectionDesktop}
            content={renderDesktopBody()}
          />
          <SettingsPageMobile
            sections={SETTINGS_SECTIONS}
            mobileView={mobileView}
            onMobileViewChange={setMobileView}
            activeSection={activeSection}
            onSelectSection={selectSectionMobile}
            activeNavItem={activeNavItem}
            detailContent={renderMobileDetailBody()}
          />
        </div>
      </PageContent>
    </Page>
  );
}
