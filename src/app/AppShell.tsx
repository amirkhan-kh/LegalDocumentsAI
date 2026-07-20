import {
  Bell,
  BrainCircuit,
  CalendarDays,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Badge, EmptyState } from "../components/ui";
import type { AuthUser } from "../features/auth/types";
import type { LegalMetrics, SearchMatch, Section } from "../features/legal/types";
import { LanguageSwitcher, useI18n } from "./i18n";
import { navItems, routeBySection } from "./navigation";

const SIDEBAR_STORAGE_KEY = "legalai.sidebar.collapsed";

type AppShellProps = {
  active: Section;
  activeLabel: string;
  metrics: LegalMetrics;
  aiQueueCount: number;
  globalSearch: string;
  globalMatches: SearchMatch[];
  user: AuthUser;
  onSearchChange: (value: string) => void;
  onOpenSearchMatch: (match: SearchMatch) => void;
  onNavigate: (section: Section) => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({
  active,
  activeLabel,
  metrics,
  aiQueueCount,
  globalSearch,
  globalMatches,
  user,
  onSearchChange,
  onOpenSearchMatch,
  onNavigate,
  onLogout,
  children,
}: AppShellProps) {
  const { language, t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchShortcut = /Mac|iPhone|iPad/.test(window.navigator.platform) ? "⌘ K" : "Ctrl K";
  const todayLabel = new Intl.DateTimeFormat(language === "uz" ? "uz-Latn-UZ" : language, {
    day: "2-digit",
    month: "short",
  }).format(new Date());

  useEffect(() => setMobileOpen(false), [active]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    sidebar.inert = isMobileViewport && !mobileOpen;
    return () => {
      sidebar.inert = false;
    };
  }, [isMobileViewport, mobileOpen]);

  useEffect(() => {
    if (!isMobileViewport || !mobileOpen) return;
    const sidebar = sidebarRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseButtonRef.current?.focus();

    const handleSidebarKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sidebar) return;
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleSidebarKeyDown);
    return () => {
      document.removeEventListener("keydown", handleSidebarKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isMobileViewport, mobileOpen]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        event.preventDefault();
        onSearchChange("");
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleSearchShortcut);
    return () => document.removeEventListener("keydown", handleSearchShortcut);
  }, [onSearchChange]);

  const toggleSidebar = () => {
    setCollapsed((current) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!current));
      return !current;
    });
  };

  const navigate = (section: Section) => {
    setMobileOpen(false);
    onNavigate(section);
  };

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <button
        type="button"
        className={`sidebar-overlay ${mobileOpen ? "visible" : ""}`}
        aria-label={t("Menyuni yopish")}
        onClick={() => setMobileOpen(false)}
      />
      <aside ref={sidebarRef} className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label={t("Asosiy bo'limlar")}>
        <div className="sidebar-head">
          <a
            className="brand"
            href={routeBySection.dashboard}
            onClick={(event) => {
              event.preventDefault();
              navigate("dashboard");
            }}
          >
            <span className="brand-orb"><ShieldCheck size={19} /></span>
            <span className="brand-copy"><strong>LegalAI</strong><small>{t("Yuridik hujjat AI")}</small></span>
          </a>
          <button
            type="button"
            className="sidebar-toggle desktop-sidebar-toggle"
            onClick={toggleSidebar}
            title={t(collapsed ? "Menyuni kengaytirish" : "Menyuni yig'ish")}
            aria-label={t(collapsed ? "Menyuni kengaytirish" : "Menyuni yig'ish")}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button ref={mobileCloseButtonRef} type="button" className="sidebar-toggle mobile-sidebar-close" onClick={() => setMobileOpen(false)} aria-label={t("Menyuni yopish")}>
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label={t("Asosiy bo'limlar")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={routeBySection[item.id]}
                className={active === item.id ? "nav-item active" : "nav-item"}
                aria-current={active === item.id ? "page" : undefined}
                title={collapsed ? t(item.label) : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.id);
                }}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{t(item.label)}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <section className="sidebar-intelligence" aria-label={t("AI holati")}>
            <span className="sidebar-card-icon"><BrainCircuit size={18} /></span>
            <div className="sidebar-card-copy">
              <small>{t("AI navbat")}</small>
              <strong>{aiQueueCount}</strong>
              <span>{t("Yuqori risk")}: {metrics.highRisks}</span>
            </div>
            <i className="online-dot" title={t("Faol")} />
          </section>

          <section className="sidebar-language-card" aria-label={t("Til")}>
            <LanguageSwitcher compact={collapsed} />
          </section>

          <section className="sidebar-user-card">
            <span className="user-avatar">{user.initials}</span>
            <div className="sidebar-user-copy">
              <small>{t("Xavfsiz sessiya")}</small>
              <strong>{user.displayName}</strong>
              <span><i className="online-dot" /> {t("Faol")}</span>
            </div>
          </section>

          <button type="button" className="logout-button" onClick={() => void logout()} disabled={isLoggingOut} title={t("Chiqish")}>
            <LogOut size={18} /> <span>{t("Chiqish")}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <button type="button" className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label={t("Menyuni ochish")} aria-expanded={mobileOpen}>
              <Menu size={20} />
            </button>
            <div>
              <p className="eyebrow"><Sparkles size={13} /> {t("LEGAL INTELLIGENCE")}</p>
              <h1>{t(activeLabel)}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={globalSearch}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t("Shartnoma, kontragent yoki band qidirish")}
                aria-label={t("Global qidiruv")}
                aria-controls="global-search-results"
                aria-expanded={Boolean(globalSearch.trim())}
              />
              <kbd>{searchShortcut}</kbd>
            </label>
            <span className="topbar-date"><CalendarDays size={16} /> {todayLabel}</span>
            <button
              type="button"
              className="icon-button notification-button"
              title={metrics.overdue ? `${t("Kechikkan")}: ${metrics.overdue}` : t("Bildirishnomalar")}
              aria-label={metrics.overdue ? `${t("Kechikkan")}: ${metrics.overdue}` : t("Bildirishnomalar")}
              onClick={() => navigate("obligations")}
            >
              <Bell size={18} aria-hidden="true" />
              {metrics.overdue > 0 && <i>{Math.min(metrics.overdue, 9)}</i>}
            </button>
            <button type="button" className="primary-button" onClick={() => navigate("review")}>
              <Upload size={17} aria-hidden="true" /> <span>{t("Hujjat yuklash")}</span>
            </button>
          </div>
        </header>

        {globalSearch.trim() && (
          <section id="global-search-results" className="global-search-results" aria-label={t("Qidiruv natijalari")} aria-live="polite">
            {globalMatches.length ? globalMatches.map((match) => (
              <button type="button" key={match.id} className="search-result" onClick={() => onOpenSearchMatch(match)}>
                <span>
                  <strong>{match.label}</strong>
                  <small>{match.detail}</small>
                </span>
                <Badge tone="neutral">{navItems.find((item) => item.id === match.section)?.label ?? match.section}</Badge>
              </button>
            )) : <EmptyState icon={Search} title="Natija topilmadi" text="Reyestrga saqlangan shartnoma, risk yoki majburiyat bo'yicha qidiring." />}
          </section>
        )}
        {children}
      </main>
    </div>
  );
}
