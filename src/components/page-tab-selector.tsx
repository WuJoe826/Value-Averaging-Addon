import { AnimatedToggleGroup } from "@wealthfolio/ui";

export type AddonPageTab = "dashboard" | "settings";

const desktopTabs = [
  { value: "dashboard" as const, label: "Dashboard" },
  { value: "settings" as const, label: "Settings" },
];

const mobileTabs = [
  { value: "dashboard" as const, label: "Dash" },
  { value: "settings" as const, label: "Set" },
];

interface PageTabSelectorProps {
  currentPage: AddonPageTab;
  onPageChange: (nextPage: AddonPageTab) => void;
}

export function PageTabSelector({ currentPage, onPageChange }: PageTabSelectorProps) {
  return (
    <>
      <div className="hidden sm:block">
        <AnimatedToggleGroup
          items={desktopTabs}
          value={currentPage}
          onValueChange={onPageChange}
          variant="secondary"
          size="sm"
          rounded="full"
        />
      </div>
      <div className="block sm:hidden">
        <AnimatedToggleGroup
          items={mobileTabs}
          value={currentPage}
          onValueChange={onPageChange}
          variant="secondary"
          size="xs"
          rounded="full"
        />
      </div>
    </>
  );
}
