import React from "react";
import type { PreferenceSection, SettingsNavSection } from "./settings-nav-config";

export interface SettingsPageDesktopProps {
  sections: SettingsNavSection[];
  activeSection: PreferenceSection;
  onSelectSection: (section: PreferenceSection) => void;
  content: React.ReactNode;
}

export function SettingsPageDesktop({
  sections,
  activeSection,
  onSelectSection,
  content,
}: SettingsPageDesktopProps) {
  return (
    <div className="hidden lg:flex lg:w-full lg:justify-start">
      <div className="flex w-full max-w-6xl flex-col px-3 lg:px-3">
        <div className="flex gap-10">
          <aside className="hidden w-[240px] shrink-0 lg:sticky lg:top-24 lg:flex lg:flex-col lg:self-start">
            <div className="space-y-6">
              {sections.map((section) => (
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
                          onClick={() => onSelectSection(item.key)}
                          className={`inline-flex h-9 w-full items-center justify-start gap-2 rounded-md px-2 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-muted text-foreground hover:bg-muted"
                              : "text-foreground hover:bg-muted/50 hover:text-muted-foreground"
                          }`}
                        >
                          <span className="inline-flex items-center justify-center [&_svg]:size-4">{item.icon}</span>
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
            <div className="w-full max-w-4xl">{content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
