import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../app/i18n";

export function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const { t } = useI18n();
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{t(label)}</span>
      <strong>{typeof value === "string" ? t(value) : value}</strong>
      <small>{t(detail)}</small>
    </div>
  );
}

export function PageIntro({ icon: Icon, title, subtitle, items, action }: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: string | number; tone?: "neutral" | "success" | "danger" | "warning" | "info" }>;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="page-intro" aria-labelledby={`${slug(title)}-intro-title`}>
      <div className="page-intro-main">
          <div className="page-intro-icon"><Icon size={22} aria-hidden="true" /></div>
        <div>
          <h2 id={`${slug(title)}-intro-title`}>{t(title)}</h2>
          <p>{t(subtitle)}</p>
        </div>
      </div>
      <div className="page-intro-items">
        {items.map((item) => (
          <div className={`page-intro-item ${item.tone ?? "neutral"}`} key={`${item.label}-${item.value}`}>
            <span>{t(item.label)}</span>
            <strong title={typeof item.value === "string" ? t(item.value) : String(item.value)}>{typeof item.value === "string" ? t(item.value) : item.value}</strong>
          </div>
        ))}
      </div>
      {action && <div className="page-intro-action">{action}</div>}
    </section>
  );
}

export function Panel({ title, subtitle, icon: Icon, children }: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-icon"><Icon size={18} aria-hidden="true" /></div>
        <div>
          <h2>{t(title)}</h2>
          {subtitle && <p>{t(subtitle)}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
}) {
  const { t } = useI18n();
  return <span className={`badge ${tone}`}>{typeof children === "string" ? t(children) : children}</span>;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div className="key-value">
      <span>{t(label)}</span>
      <strong>{t(value)}</strong>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <Icon size={36} />
      <h3>{t(title)}</h3>
      <p>{t(text)}</p>
    </div>
  );
}

export function Bar({ label, value, max, tone }: {
  label: string;
  value: number;
  max: number;
  tone: "danger" | "warning" | "success" | "info";
}) {
  const { t } = useI18n();
  return (
    <div className="bar-row">
      <div>
        <span>{t(label)}</span>
        <strong>{value}</strong>
      </div>
      <div className={`bar ${tone}`}><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
    </div>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
