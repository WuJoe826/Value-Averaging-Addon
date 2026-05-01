import { Icons } from "@wealthfolio/ui";

export type AddonPageTab = "dashboard" | "settings";

const desktopTabs = [
  { value: "dashboard" as const, label: "Dashboard", icon: Icons.LayoutDashboard },
  { value: "settings" as const, label: "Settings", icon: Icons.Settings },
];

const mobileTabs = [
  { value: "dashboard" as const, label: "Dashboard", icon: Icons.LayoutDashboard },
  { value: "settings" as const, label: "Settings", icon: Icons.Settings },
];

interface PageTabSelectorProps {
  currentPage: AddonPageTab;
  onPageChange: (nextPage: AddonPageTab) => void;
}

export function PageTabSelector({ currentPage, onPageChange }: PageTabSelectorProps) {
  return (
    <>
      <div className="hidden sm:block">
        <div className="bg-secondary/50 inline-flex items-center rounded-full border p-0.5">
          {desktopTabs.map((tab) => {
            const isSelected = currentPage === tab.value;
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onPageChange(tab.value)}
                className={`inline-flex h-8 items-center rounded-full px-3 text-sm transition-all ${
                  isSelected
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="mr-1.5 size-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="block sm:hidden">
        <div className="bg-secondary/50 inline-flex items-center gap-0.5 rounded-full border p-0.5">
          {mobileTabs.map((tab) => {
            const isSelected = currentPage === tab.value;
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onPageChange(tab.value)}
                aria-label={tab.label}
                className={`inline-flex h-7 items-center rounded-full transition-all ${
                  isSelected
                    ? "bg-background px-2.5 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground w-8 justify-center"
                }`}
              >
                <Icon className="size-4" />
                {isSelected && <span className="ml-1 text-xs font-medium">{tab.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
