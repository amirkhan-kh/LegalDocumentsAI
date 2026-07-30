import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, RefreshCw, Shield, Zap } from "lucide-react";
import { useI18n } from "../../app/i18n";
import {
  superAdminActivateOrg,
  superAdminExtendTrial,
  superAdminListOrgs,
  superAdminSuspendOrg,
} from "../auth/api";
import type { AuthSession, SuperAdminOrg } from "../auth/types";

const PLAN_CODES = [
  { value: "start", label: "Start" },
  { value: "growth", label: "Growth" },
  { value: "business", label: "Business" },
  { value: "scale", label: "Scale" },
];

type SuperAdminPageProps = {
  session: AuthSession;
  onNavigate: (path: string) => void;
};

export function SuperAdminPage({ session, onNavigate }: SuperAdminPageProps) {
  const { t, language } = useI18n();
  const [orgs, setOrgs] = useState<SuperAdminOrg[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [planPick, setPlanPick] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const rows = await superAdminListOrgs(session.csrfToken);
      setOrgs(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Yuklash xatosi"));
    } finally {
      setLoading(false);
    }
  }, [session.csrfToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((org) => {
      const hay = `${org.name || ""} ${org.slug || ""} ${org.status || ""} ${org.plan?.name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orgs, query]);

  const trialCount = orgs.filter((o) => o.status === "trial").length;
  const activeCount = orgs.filter((o) => o.status === "active").length;

  async function activate(orgId: string) {
    const plan = planPick[orgId] || "growth";
    setBusyId(orgId);
    try {
      await superAdminActivateOrg(session.csrfToken, orgId, plan, 30);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Xatolik"));
    } finally {
      setBusyId("");
    }
  }

  async function extendTrial(orgId: string) {
    setBusyId(orgId);
    try {
      await superAdminExtendTrial(session.csrfToken, orgId, 3);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Xatolik"));
    } finally {
      setBusyId("");
    }
  }

  async function suspend(orgId: string) {
    if (!window.confirm(t("Ushbu tashkilot to'xtatilsinmi?"))) return;
    setBusyId(orgId);
    try {
      await superAdminSuspendOrg(session.csrfToken, orgId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Xatolik"));
    } finally {
      setBusyId("");
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  return (
    <div className="sa-page">
      <header className="sa-topbar">
        <div className="sa-topbar-left">
          <button type="button" className="sa-back" onClick={() => onNavigate("/dashboard")}>
            <ArrowLeft size={16} />
            {t("Dashboard")}
          </button>
          <div>
            <p className="sa-eyebrow">Platform control</p>
            <h1>{t("Super Admin")}</h1>
          </div>
        </div>
        <div className="sa-stats">
          <span>
            <Building2 size={14} /> {orgs.length} {t("tashkilot")}
          </span>
          <span>
            <Zap size={14} /> {trialCount} trial
          </span>
          <span className="is-ok">
            <Shield size={14} /> {activeCount} active
          </span>
        </div>
      </header>

      <p className="sa-lead">
        {t("Tashkilotlar, trial va manual tarif yoqish. To'lov tashqi; shu yerdan plan faollashtiriladi.")}
      </p>

      {error ? (
        <div className="sa-error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="sa-toolbar panel">
        <label className="sa-search">
          <span>{t("Qidiruv")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Tashkilot, slug yoki status...")}
          />
        </label>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />
          {t("Yangilash")}
        </button>
      </section>

      <section className="panel sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>{t("Tashkilot")}</th>
              <th>{t("Status")}</th>
              <th>{t("Plan")}</th>
              <th>{t("Usage")}</th>
              <th>{t("Trial tugashi")}</th>
              <th>{t("Amallar")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>{t("Yuklanmoqda...")}</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>{t("Tashkilot topilmadi")}</td>
              </tr>
            ) : (
              filtered.map((org) => (
                <tr key={org.id}>
                  <td>
                    <strong>{org.name}</strong>
                    <small>
                      {org.slug}
                      {org.owner?.email ? ` · ${org.owner.email}` : ""}
                    </small>
                  </td>
                  <td>
                    <span className={`sa-status sa-status-${org.status}`}>{org.status}</span>
                  </td>
                  <td>{org.plan?.name || org.planCode || "—"}</td>
                  <td>
                    {org.usage ? `${org.usage.analyses} / ${org.usage.limit}` : "—"}
                  </td>
                  <td>{formatDate(org.trialEndsAt)}</td>
                  <td>
                    <div className="sa-actions">
                      <select
                        value={planPick[org.id] || org.preferredPlanCode || org.planCode || "growth"}
                        onChange={(e) => setPlanPick((prev) => ({ ...prev, [org.id]: e.target.value }))}
                      >
                        {PLAN_CODES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" disabled={busyId === org.id} onClick={() => void activate(org.id)}>
                        {t("Faollashtirish")}
                      </button>
                      <button type="button" disabled={busyId === org.id} onClick={() => void extendTrial(org.id)}>
                        +3d trial
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        disabled={busyId === org.id}
                        onClick={() => void suspend(org.id)}
                      >
                        {t("To'xtatish")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
