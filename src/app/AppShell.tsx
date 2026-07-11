import { Bell, Search, ShieldCheck, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, EmptyState } from "../components/ui";
import type { LegalMetrics, SearchMatch, Section } from "../features/legal/types";
import { navItems, routeBySection } from "./navigation";

type AppShellProps = {
  active: Section;
  activeLabel: string;
  metrics: LegalMetrics;
  aiQueueCount: number;
  globalSearch: string;
  globalMatches: SearchMatch[];
  onSearchChange: (value: string) => void;
  onOpenSearchMatch: (match: SearchMatch) => void;
  onNavigate: (section: Section) => void;
  children: ReactNode;
};

export function AppShell({
  active,
  activeLabel,
  metrics,
  aiQueueCount,
  globalSearch,
  globalMatches,
  onSearchChange,
  onOpenSearchMatch,
  onNavigate,
  children,
}: AppShellProps) {
  const todayLabel = new Intl.DateTimeFormat("uz-Latn-UZ", { day: "2-digit", month: "short" }).format(new Date());

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={22} /></div>
          <div>
            <strong>LegalAI</strong>
            <span>Yuridik hujjat AI</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Asosiy bo'limlar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={routeBySection[item.id]}
                className={active === item.id ? "nav-item active" : "nav-item"}
                aria-current={active === item.id ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.id);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="mini-stat">
            <span>AI navbat</span>
            <strong>{aiQueueCount}</strong>
          </div>
          <div className="mini-stat">
            <span>Bugungi sana</span>
            <strong>{todayLabel}</strong>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Yuridik hujjatlar operatsion paneli</p>
            <h1>{activeLabel}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} aria-hidden="true" />
              <input
                value={globalSearch}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Shartnoma, kontragent yoki band qidirish"
                aria-label="Global qidiruv"
              />
            </label>
            <button type="button" className="icon-button" title="Bildirishnomalar" aria-label="Bildirishnomalar">
              <Bell size={18} aria-hidden="true" />
            </button>
            <button type="button" className="primary-button" onClick={() => onNavigate("review")}>
              <Upload size={17} aria-hidden="true" /> Hujjat yuklash
            </button>
          </div>
        </header>
        {globalSearch.trim() && (
          <div className="global-search-results" role="listbox" aria-label="Qidiruv natijalari">
            {globalMatches.length ? globalMatches.map((match) => (
              <button type="button" key={match.id} className="search-result" onClick={() => onOpenSearchMatch(match)}>
                <span>
                  <strong>{match.label}</strong>
                  <small>{match.detail}</small>
                </span>
                <Badge tone="neutral">{navItems.find((item) => item.id === match.section)?.label ?? match.section}</Badge>
              </button>
            )) : <EmptyState icon={Search} title="Natija topilmadi" text="Reyestrga saqlangan shartnoma, risk yoki majburiyat bo'yicha qidiring." />}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
