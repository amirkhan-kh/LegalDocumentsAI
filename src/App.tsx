import { useEffect, useState } from "react";
import { AppShell } from "./app/AppShell";
import { labelForSection, routeBySection, sectionByRoute, sectionFromPath } from "./app/navigation";
import { useAuth } from "./features/auth/AuthBoundary";
import { LegalWorkspaceRouter } from "./features/legal/LegalWorkspaceRouter";
import { useLegalWorkspace } from "./features/legal/state/useLegalWorkspace";
import type { Section } from "./features/legal/types";

function App() {
  const { session, logout } = useAuth();
  const [active, setActive] = useState<Section>(() => sectionFromPath(window.location.pathname));

  useEffect(() => {
    if (!sectionByRoute[window.location.pathname]) {
      window.history.replaceState({ section: "dashboard" }, "", routeBySection.dashboard);
    }
    const handlePopState = () => setActive(sectionFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (section: Section) => {
    setActive(section);
    const nextPath = routeBySection[section];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ section }, "", nextPath);
    }
  };

  const workspace = useLegalWorkspace({ navigateTo });

  return (
    <AppShell
      active={active}
      activeLabel={labelForSection(active)}
      metrics={workspace.metrics}
      aiQueueCount={workspace.aiQueueCount}
      globalSearch={workspace.globalSearch}
      globalMatches={workspace.globalMatches}
      user={session.user}
      onSearchChange={workspace.setGlobalSearch}
      onOpenSearchMatch={workspace.openSearchMatch}
      onNavigate={navigateTo}
      onLogout={logout}
    >
      <LegalWorkspaceRouter active={active} workspace={workspace} onNavigate={navigateTo} />
    </AppShell>
  );
}

export default App;
