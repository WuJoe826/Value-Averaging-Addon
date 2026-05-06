import type { AddonContext } from "@wealthfolio/addon-sdk";
import { Page, PageContent, PageHeader } from "@wealthfolio/ui";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AboutSettingsSection,
  GeneralSettingsSection,
  PageTabSelector,
  PortfolioSettingsSection,
  type AddonPageTab,
} from "../components";
import { calculatePercentageTopUpAmount, canCalculatePercentageTopUp } from "../lib";
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

  const persistRef = useRef(onConfirmSettings);
  persistRef.current = onConfirmSettings;
  const totalAllocation = useMemo(
    () =>
      tickers
        .filter((ticker) => draft.enabledTickers[ticker.id])
        .reduce((total, ticker) => total + (draft.tickerAllocations[ticker.id] ?? 0), 0),
    [draft, tickers],
  );
  const roundedAllocationTotal = useMemo(
    () => (totalAllocation >= 99.9 && totalAllocation <= 100 ? 100 : totalAllocation),
    [totalAllocation],
  );
  const isAllocationValid = useMemo(
    () => totalAllocation >= 99.9 && totalAllocation <= 100,
    [totalAllocation],
  );
  const hasPortfolioChanges = useMemo(
    () =>
      JSON.stringify(draft.enabledTickers) !== JSON.stringify(settings.enabledTickers) ||
      JSON.stringify(draft.tickerAllocations) !== JSON.stringify(settings.tickerAllocations),
    [draft.enabledTickers, draft.tickerAllocations, settings.enabledTickers, settings.tickerAllocations],
  );
  const enabledTickers = useMemo(
    () => tickers.filter((ticker) => draft.enabledTickers[ticker.id]),
    [draft.enabledTickers, tickers],
  );
  const isPercentageTopUpAvailable = useMemo(
    () => canCalculatePercentageTopUp(draft, enabledTickers),
    [draft, enabledTickers],
  );
  const percentageTopUpPreviewAmount = useMemo(
    () => (isPercentageTopUpAvailable ? calculatePercentageTopUpAmount(draft, enabledTickers) : 0),
    [draft, enabledTickers, isPercentageTopUpAvailable],
  );

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setDraft((prev) => {
      const nextTopUpMode =
        prev.topUpMode === "percentage" && !isPercentageTopUpAvailable ? "amount" : prev.topUpMode;
      const nextCalculatedTopUpAmount =
        nextTopUpMode === "percentage" ? percentageTopUpPreviewAmount : Math.max(0, prev.topUpAmount);
      const sameTopUpMode = prev.topUpMode === nextTopUpMode;
      const sameCalculatedAmount =
        Math.abs((prev.calculatedTopUpAmount ?? 0) - nextCalculatedTopUpAmount) < 0.000001;
      if (sameTopUpMode && sameCalculatedAmount) {
        return prev;
      }
      return {
        ...prev,
        topUpMode: nextTopUpMode,
        calculatedTopUpAmount: nextCalculatedTopUpAmount,
      };
    });
  }, [draft.topUpAmount, draft.topUpMode, isPercentageTopUpAvailable, percentageTopUpPreviewAmount]);

  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(settings)) {
      return;
    }
    if (hasPortfolioChanges && !isAllocationValid) {
      return;
    }
    const id = window.setTimeout(() => {
      persistRef.current({ ...draft });
      ctx.api.logger.info("Value averaging settings auto-saved (local storage)");
    }, 400);
    return () => window.clearTimeout(id);
  }, [draft, hasPortfolioChanges, isAllocationValid, settings]);
  const allNavItems = SETTINGS_SECTIONS.flatMap((section) => section.items);
  const activeNavItem = allNavItems.find((item) => item.key === activeSection);
  const sectionMeta = getSectionMeta(activeSection);

  const headerActions = <PageTabSelector currentPage={currentPage} onPageChange={onPageChange} />;

  const selectSectionDesktop = (section: PreferenceSection) => {
    setActiveSection(section);
  };

  const selectSectionMobile = (section: PreferenceSection) => {
    setActiveSection(section);
    setMobileView("detail");
  };
  const resetPortfolioDraft = () => {
    setDraft((prev) => ({
      ...prev,
      enabledTickers: { ...settings.enabledTickers },
      tickerAllocations: { ...settings.tickerAllocations },
    }));
  };

  const renderDesktopBody = () => {
    if (activeSection === "general") {
      return (
        <GeneralSettingsSection
          layout="desktop"
          baseCurrency={baseCurrency}
          draft={draft}
          setDraft={setDraft}
          isPercentageTopUpAvailable={isPercentageTopUpAvailable}
          percentageTopUpPreviewAmount={percentageTopUpPreviewAmount}
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
          totalAllocation={roundedAllocationTotal}
          isAllocationValid={isAllocationValid}
          title={sectionMeta.title}
          description={sectionMeta.description}
          onReset={resetPortfolioDraft}
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
          isPercentageTopUpAvailable={isPercentageTopUpAvailable}
          percentageTopUpPreviewAmount={percentageTopUpPreviewAmount}
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
          totalAllocation={roundedAllocationTotal}
          isAllocationValid={isAllocationValid}
          title={sectionMeta.title}
          description={sectionMeta.description}
          onReset={resetPortfolioDraft}
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
