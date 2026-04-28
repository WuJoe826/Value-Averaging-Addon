import type { AddonContext } from "@wealthfolio/addon-sdk";
import { Card, CardContent, Icons } from "@wealthfolio/ui";
import React from "react";

function AddonExample({ ctx }: { ctx: AddonContext }) {
  return (
    <div className="p-6">
      <Card>
        <CardContent className="p-6">
          <h1 className="mb-2 text-2xl font-semibold">Value Averaging</h1>
          <p className="text-muted-foreground">
            Welcome to your new Wealthfolio addon! Start building amazing features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function enable(ctx: AddonContext) {
  // Add a sidebar item
  const sidebarItem = ctx.sidebar.addItem({
    id: "value-averaging-addon",
    label: "Value Averaging",
    icon: <Icons.Money className="h-5 w-5" />,
    route: "/addon/value-averaging-addon",
    order: 100,
  });

  // Add a route
  const Wrapper = () => <AddonExample ctx={ctx} />;
  ctx.router.add({
    path: "/addon/value-averaging-addon",
    component: React.lazy(() => Promise.resolve({ default: Wrapper })),
  });

  // Cleanup on disable
  ctx.onDisable(() => {
    try {
      sidebarItem.remove();
    } catch (err) {
      ctx.api.logger.error("Failed to remove sidebar item: " + (err as Error).message);
    }
  });
}
