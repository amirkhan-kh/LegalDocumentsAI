import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
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
  return (
    <section className="page-intro" aria-labelledby={`${slug(title)}-intro-title`}>
      <div className="page-intro-main">
        <div className="page-intro-icon"><Icon size={22} /></div>
        <div>
          <h2 id={`${slug(title)}-intro-title`}>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="page-intro-items">
        {items.map((item) => (
          <div className={`page-intro-item ${item.tone ?? "neutral"}`} key={`${item.label}-${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
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
  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-icon"><Icon size={18} /></div>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
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
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="empty-state">
      <Icon size={36} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function Bar({ label, value, max, tone }: {
  label: string;
  value: number;
  max: number;
  tone: "danger" | "warning" | "success" | "info";
}) {
  return (
    <div className="bar-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={`bar ${tone}`}><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
    </div>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
