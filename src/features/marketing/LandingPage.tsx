import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Banknote,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  FileSearch,
  FileText,
  Gavel,
  Landmark,
  ListChecks,
  Mail,
  Menu,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useI18n } from "../../app/i18n";
import { fetchPublicPlans } from "../auth/api";
import type { AuthSession, PublicPlan } from "../auth/types";

const COMPANY = "Aviora AI";
const PRODUCT = "LegalAI";
const CONTACT_EMAIL = "avioraai1@gmail.com";

const NAV_LINKS = [
  { href: "#haqida", labelKey: "Loyiha" },
  { href: "#qanday-ishlaydi", labelKey: "Qanday ishlaydi" },
  { href: "#mijozlar", labelKey: "Kimlar uchun" },
  { href: "#tariflar", labelKey: "Tariflar" },
  { href: "#aloqa", labelKey: "Aloqa" },
] as const;

const HOW_STEPS = [
  {
    icon: FileText,
    titleKey: "Yuklang",
    textKey: "Shartnoma yoki yuridik PDF ni xavfsiz yuklaysiz.",
    step: "01",
    tone: "a",
  },
  {
    icon: Sparkles,
    titleKey: "AI o'qiydi",
    textKey: "Vertex AI bandlar, tomonlar va shartlarni chiqaradi.",
    step: "02",
    tone: "b",
  },
  {
    icon: Scale,
    titleKey: "Baholash",
    textKey: "Risk, majburiyat va muddatlar tizimlashtiriladi.",
    step: "03",
    tone: "c",
  },
  {
    icon: ListChecks,
    titleKey: "Harakat",
    textKey: "Jamoa review, vazifa va nazoratni bir joyda olib boradi.",
    step: "04",
    tone: "d",
  },
] as const;

const FEATURES = [
  {
    icon: FileSearch,
    titleKey: "Chuquur PDF tahlil",
    textKey: "Uzun shartnomalarni sahifa bo'ylab o'qib, strukturali natija beradi.",
    wide: true,
    tone: "a",
  },
  {
    icon: Gavel,
    titleKey: "Risk ko'rinishi",
    textKey: "Yuqori xavfli bandlar va noaniq shartlar alohida ajratiladi.",
    tone: "b",
  },
  {
    icon: ListChecks,
    titleKey: "Majburiyatlar",
    textKey: "To'lov, muddat va bajarish majburiyatlari navbatga tushadi.",
    tone: "c",
  },
  {
    icon: BookOpen,
    titleKey: "Bilim bazasi",
    textKey: "Siyosat va playbooklar tahlil kontekstiga qo'shiladi.",
    tone: "d",
  },
] as const;

const AUDIENCE = [
  { name: "Yuridik firmalar", hint: "Ko'p shartnoma oqimi", icon: Briefcase, tone: "a", metric: "50+" },
  { name: "Korporativ legal", hint: "Ichki compliance", icon: Building2, tone: "b", metric: "SLA" },
  { name: "Startup va fintech", hint: "Tezkor review", icon: Sparkles, tone: "c", metric: "24h" },
  { name: "Bank va sug'urta", hint: "Risk nazorati", icon: Landmark, tone: "d", metric: "Risk" },
  { name: "Agentliklar", hint: "Mijoz hujjatlari", icon: Users, tone: "e", metric: "Multi" },
  { name: "Notarius / konsultant", hint: "Kunlik PDF ishi", icon: Banknote, tone: "f", metric: "PDF" },
] as const;

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number, language: string) {
  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
  return new Intl.NumberFormat(locale).format(value);
}

function scrollToHash(hash: string) {
  if (!hash || hash === "#") return;
  const id = hash.replace(/^#/, "");
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Legal document sheets — fixed size; compact copy that fully fits each card.
 * Title bold/larger; body & meta smaller. No clipped text.
 */
function HeroPaperDeck({ t }: { t: (value: string) => string }) {
  return (
    <div className="lp-fan" aria-hidden="true">
      <div className="lp-fan-glow" />

      <article className="lp-note lp-note-5 doc-memo">
        <p className="lp-doc-ref">REF-KB/12 · CONFIDENTIAL</p>
        <h3 className="lp-doc-title">{t("Bilim bazasi")}</h3>
        <div className="lp-doc-main">
          <p className="lp-doc-sub">Internal policy pack</p>
          <ol className="lp-doc-lines">
            <li>1. Policy playbook</li>
            <li>2. Approval matrix</li>
            <li>3. CRM script</li>
            <li>4. Risk checklist</li>
          </ol>
        </div>
        <p className="lp-doc-sign">/s/ Legal Ops</p>
      </article>

      <article className="lp-note lp-note-4 doc-brief">
        <p className="lp-doc-ref">BRIEF · AI SCORE</p>
        <h3 className="lp-doc-title">{t("Analitika")}</h3>
        <div className="lp-doc-main">
          <div className="lp-doc-score-row">
            <span>
              AI ball <em>87</em>
            </span>
            <span>
              {t("Yuqori risk")} <em>3</em>
            </span>
          </div>
          <div className="lp-doc-bars" aria-hidden="true">
            <i style={{ height: "40%" }} />
            <i style={{ height: "68%" }} />
            <i style={{ height: "52%" }} />
            <i style={{ height: "86%" }} />
            <i style={{ height: "44%" }} />
          </div>
        </div>
        <p className="lp-doc-foot">Portfolio · Q3</p>
      </article>

      <article className="lp-note lp-note-3 doc-schedule">
        <p className="lp-doc-ref">SCH-OBL · 12 items</p>
        <h3 className="lp-doc-title">{t("Majburiyatlar")}</h3>
        <div className="lp-doc-main">
          <ul className="lp-doc-plain">
            <li>
              <span>§1</span> {t("To'lov")} — 15 {t("kun")}
            </li>
            <li>
              <span>§2</span> {t("Muddat")} — 30 {t("kun")}
            </li>
            <li>
              <span>§3</span> {t("Hisobot")} — OK
            </li>
            <li>
              <span>§4</span> SLA — pending
            </li>
          </ul>
        </div>
        <p className="lp-doc-sign">Schedule A</p>
      </article>

      <article className="lp-note lp-note-2 doc-register">
        <p className="lp-doc-ref">REGISTER · REG-08</p>
        <h3 className="lp-doc-title">{t("Shartnomalar")}</h3>
        <div className="lp-doc-main">
          <table className="lp-doc-table">
            <tbody>
              <tr>
                <td>MSA-014</td>
                <td>{t("Yuqori")}</td>
              </tr>
              <tr>
                <td>NDA-221</td>
                <td>{t("Past")}</td>
              </tr>
              <tr>
                <td>SLA-09</td>
                <td>{t("O'rta")}</td>
              </tr>
              <tr>
                <td>SOW-03</td>
                <td>{t("O'rta")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="lp-doc-foot">Registry extract</p>
      </article>

      <article className="lp-note lp-note-1 doc-opinion">
        <p className="lp-doc-ref">MSA-2026-014 · OPINION</p>
        <h3 className="lp-doc-title">{t("Tahlil")}</h3>
        <div className="lp-doc-main">
          <p className="lp-doc-meta">
            {t("Tomonlar")}: 2 · {t("Risk")}: {t("Yuqori")} · {t("Majburiyat")}: 12
          </p>
          <p className="lp-doc-body">{t("To'lov muddati 15 kun — diqqat talab qiladi")}.</p>
          <p className="lp-doc-body">{t("Bir tomonlama bekor qilish bandi")}.</p>
          <p className="lp-doc-body">{t("Maxfiylik muddati aniq belgilangan")}.</p>
        </div>
        <p className="lp-doc-sign">
          <ShieldCheck size={10} /> {t("Maxfiy ishlov")}
        </p>
      </article>
    </div>
  );
}

type LandingPageProps = {
  session: AuthSession | null;
  onNavigate: (path: string) => void;
};

export function LandingPage({ session, onNavigate }: LandingPageProps) {
  const { language, setLanguage, t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [trialDays, setTrialDays] = useState(3);
  const authed = Boolean(session);

  useEffect(() => {
    void fetchPublicPlans()
      .then((data) => {
        setPlans(data.plans || []);
        setTrialDays(data.trialDays || 3);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      requestAnimationFrame(() => scrollToHash(window.location.hash));
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 960) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Lightweight scroll reveal — class toggle only, no layout thrash
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-lp-reveal]"));
    if (!nodes.length) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [plans.length]);

  const ctaHref = authed ? "/dashboard" : "/register";
  const ctaLabel = authed ? t("Dashboardga o'tish") : t("3 kun bepul boshlash");

  const orderedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [plans],
  );

  function handleNavClick(event: React.MouseEvent, href: string) {
    if (!href.startsWith("#")) return;
    event.preventDefault();
    setMenuOpen(false);
    const url = new URL(window.location.href);
    url.hash = href;
    window.history.pushState(null, "", url);
    scrollToHash(href);
  }

  function go(path: string) {
    setMenuOpen(false);
    onNavigate(path);
  }

  return (
    <div className={`lp-page${menuOpen ? " is-menu-open" : ""}`}>
      {/* Ambient creative background — GPU-friendly blurs + soft gradients */}
      <div className="lp-atmosphere" aria-hidden="true">
        <span className="lp-orb lp-orb-a" />
        <span className="lp-orb lp-orb-b" />
        <span className="lp-orb lp-orb-c" />
        <span className="lp-orb lp-orb-d" />
        <span className="lp-mesh" />
        <span className="lp-shine" />
      </div>

      <header className={`lp-head${scrolled || menuOpen ? " is-scrolled" : ""}`}>
        <div className="lp-container lp-head-inner">
          <button type="button" className="lp-brand" onClick={() => go("/")}>
            <span className="lp-brand-mark">
              <Scale size={18} />
            </span>
            <span className="lp-brand-text">
              <strong>{PRODUCT}</strong>
              <small>{COMPANY}</small>
            </span>
          </button>

          <nav className="lp-nav" aria-label={t("Asosiy bo'limlar")}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={(e) => handleNavClick(e, link.href)}>
                {t(link.labelKey)}
              </a>
            ))}
          </nav>

          <div className="lp-head-actions">
            <div className="lp-lang" title={t("Til")}>
              {(["uz", "ru", "en"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={language === item ? "is-active" : ""}
                  aria-pressed={language === item}
                  onClick={() => setLanguage(item)}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            {!authed ? (
              <button type="button" className="lp-btn lp-btn-ghost" onClick={() => go("/login")}>
                {t("Kirish")}
              </button>
            ) : null}
            <button type="button" className="lp-btn lp-btn-primary" onClick={() => go(ctaHref)}>
              {authed ? t("Dashboard") : t("Bepul boshlash")}
            </button>
            <button
              type="button"
              className="lp-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="lp-mobile-nav"
              aria-label={menuOpen ? t("Yopish") : t("Menyu")}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className={`lp-mobile${menuOpen ? " is-open" : ""}`} id="lp-mobile-nav" hidden={!menuOpen}>
        <nav aria-label={t("Asosiy bo'limlar")}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={(e) => handleNavClick(e, link.href)}>
              {t(link.labelKey)}
            </a>
          ))}
        </nav>
        <div className="lp-mobile-actions">
          <div className="lp-lang">
            {(["uz", "ru", "en"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={language === item ? "is-active" : ""}
                onClick={() => setLanguage(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="lp-btn lp-btn-primary lp-btn-block" onClick={() => go(ctaHref)}>
            {ctaLabel}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <button type="button" className="lp-scrim" aria-label={t("Yopish")} onClick={() => setMenuOpen(false)} />
      ) : null}

      <main className="lp-body">
        <div className="lp-container">
          {/* HERO */}
          <section className="lp-hero">
            <div className="lp-hero-copy" data-lp-reveal>
              <span className="lp-eyebrow">
                <i />
                {COMPANY} · {t("Yuridik hujjat AI")}
              </span>
              <h1>
                {t("Shartnomalaringizni tushunadigan")}
                <em> {t("yuridik ish stoli")}</em>
              </h1>
              <p>
                {t(
                  "PDF shartnomalarni yuklang — AI tomonlar, risklar, majburiyatlar va muddatlarni ajratib, jamoangiz uchun aniq ish oqimini ochadi.",
                )}
              </p>
              <div className="lp-cta-row">
                <button type="button" className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => go(ctaHref)}>
                  {ctaLabel}
                  <ArrowUpRight size={16} />
                </button>
                <a
                  className="lp-btn lp-btn-soft lp-btn-lg"
                  href="#qanday-ishlaydi"
                  onClick={(e) => handleNavClick(e, "#qanday-ishlaydi")}
                >
                  {t("Qanday ishlaydi")}
                </a>
              </div>
              <div className="lp-hero-pills" aria-hidden="true">
                <span>
                  <b>{trialDays}</b> {t("kun trial")}
                </span>
                <span>
                  <b>PDF</b> {t("chuqur tahlil")}
                </span>
                <span>
                  <b>AI</b> {t("risk + majburiyat")}
                </span>
              </div>
            </div>

            <div className="lp-hero-visual" data-lp-reveal>
              <HeroPaperDeck t={t} />
            </div>
          </section>

          {/* ABOUT */}
          <section className="lp-section lp-about" id="haqida">
            <div className="lp-about-grid">
              <div className="lp-about-main" data-lp-reveal>
                <div className="lp-about-main-aura" aria-hidden="true" />
                <span className="lp-section-kicker">{t("Loyiha")}</span>
                <h2>
                  {t("Yuridik hujjatlar uchun")}
                  <span>{t("operatsion platforma")}</span>
                </h2>
                <p>
                  {t(
                    "LegalAI — Aviora AI tomonidan qurilgan SaaS. Shartnoma PDF larini tahlil qiladi, risk va majburiyatlarni ajratadi, jamoaga aniq navbat beradi.",
                  )}
                </p>
                <p>
                  {t(
                    "Maqsad: kechikishlarni kamaytirish, yashirin xavflarni erta ko'rish va hujjat ishini bir stilidagi boshqaruv panelida yuritish.",
                  )}
                </p>
                <div className="lp-about-metrics">
                  <div className="tone-a">
                    <strong>Vertex AI</strong>
                    <span>{t("Chuqur o'qish")}</span>
                  </div>
                  <div className="tone-b">
                    <strong>{t("Review")}</strong>
                    <span>{t("Inson nazorati")}</span>
                  </div>
                  <div className="tone-c">
                    <strong>{t("SaaS")}</strong>
                    <span>{t("Ko'p foydalanuvchi")}</span>
                  </div>
                </div>
              </div>

              <div className="lp-feature-bento">
                {FEATURES.map((feature, index) => {
                  const Icon = feature.icon;
                  const wide = "wide" in feature && feature.wide;
                  return (
                    <article
                      key={feature.titleKey}
                      className={`lp-feature-card tone-${feature.tone}${wide ? " is-wide" : ""}`}
                      data-lp-reveal
                      style={{ ["--stagger" as string]: `${index * 60}ms` }}
                    >
                      <span className="lp-feature-shine" aria-hidden="true" />
                      <span className="lp-feature-icon">
                        <Icon size={18} />
                      </span>
                      <strong>{t(feature.titleKey)}</strong>
                      <p>{t(feature.textKey)}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* HOW */}
          <section className="lp-section lp-how" id="qanday-ishlaydi">
            <div className="lp-section-head" data-lp-reveal>
              <span className="lp-section-kicker">{t("Jarayon")}</span>
              <h2>{t("Qanday ishlaydi")}</h2>
              <p>{t("To'rt qisqa qadam. Batafsil ish oqimi dashboard ichida.")}</p>
            </div>

            <div className="lp-how-stage" data-lp-reveal>
              <div className="lp-how-rail" aria-hidden="true">
                <span className="lp-how-rail-line" />
                <span className="lp-how-rail-pulse" />
              </div>
              <div className="lp-how-grid">
                {HOW_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <article
                      key={step.step}
                      className={`lp-how-card tone-${step.tone}`}
                      style={{ ["--stagger" as string]: `${index * 80}ms` }}
                    >
                      <div className="lp-how-node" aria-hidden="true">
                        {step.step}
                      </div>
                      <div className="lp-how-top">
                        <span className="lp-how-step">{step.step}</span>
                        <span className="lp-how-icon">
                          <Icon size={18} />
                        </span>
                      </div>
                      <strong>{t(step.titleKey)}</strong>
                      <p>{t(step.textKey)}</p>
                      <div className="lp-how-viz" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* AUDIENCE */}
          <section className="lp-section lp-audience" id="mijozlar">
            <div className="lp-section-head is-center" data-lp-reveal>
              <span className="lp-section-kicker">{t("Auditoriya")}</span>
              <h2>{t("Kimlar uchun")}</h2>
              <p>{t("Hujjat oqimi yuqori bo'lgan yuridik jamoalar va firmalar.")}</p>
            </div>
            <div className="lp-audience-grid">
              {AUDIENCE.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.name}
                    className={`lp-audience-card tone-${item.tone}`}
                    data-lp-reveal
                    style={{ ["--stagger" as string]: `${index * 50}ms` }}
                  >
                    <div className="lp-audience-top">
                      <span className="lp-audience-icon">
                        <Icon size={18} />
                      </span>
                      <em>{item.metric}</em>
                    </div>
                    <strong>{t(item.name)}</strong>
                    <span>{t(item.hint)}</span>
                    <i className="lp-audience-ring" aria-hidden="true" />
                  </article>
                );
              })}
            </div>
          </section>

          {/* PRICING */}
          <section className="lp-section lp-pricing" id="tariflar">
            <div className="lp-section-head" data-lp-reveal>
              <span className="lp-section-kicker">{t("Tariflar")}</span>
              <h2>{t("Sizga mos reja")}</h2>
              <p>
                {t(
                  "Oylik AI tahlil hajmi va jamoa o'lchamiga qarab tanlang. Barcha paketlarda xavfsiz sessiya va asosiy yuridik ish oqimi bor.",
                )}
              </p>
            </div>
            <div className="lp-pricing-grid">
              {orderedPlans.map((plan, index) => (
                <article
                  key={plan.code}
                  className={`lp-plan${plan.popular ? " is-popular" : ""}`}
                  data-lp-reveal
                  style={{ ["--stagger" as string]: `${index * 70}ms` }}
                >
                  <span className="lp-plan-glow" aria-hidden="true" />
                  {plan.popular ? <span className="lp-plan-badge">{t("Tavsiya")}</span> : null}
                  <header>
                    <h3>{plan.name}</h3>
                    <p>{t(plan.blurb)}</p>
                  </header>
                  <div className="lp-plan-price">
                    <strong>{formatUsd(plan.priceUsd)}</strong>
                    <span>{t("/ oy")}</span>
                  </div>
                  <div className="lp-plan-meta">
                    <span>
                      <b>{formatCount(plan.analysesMonthly, language)}</b> {t("AI tahlil / oy")}
                    </span>
                    <span>
                      <b>{plan.seats}</b> {t("foydalanuvchi")}
                    </span>
                  </div>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={15} />
                        {t(feature)}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`lp-btn ${plan.popular ? "lp-btn-primary" : "lp-btn-soft"} lp-btn-block`}
                    onClick={() => go(authed ? "/dashboard" : `/register?plan=${plan.code}`)}
                  >
                    {authed ? t("Dashboard") : t("Tanlash")}
                  </button>
                </article>
              ))}
            </div>
            <p className="lp-pricing-note" data-lp-reveal>
              {t("Bepul sinov")} — {trialDays} {t("kun")}. {t("To'lovdan keyin super admin tarifni faollashtiradi.")}
            </p>
          </section>

          {/* CONTACT */}
          <section className="lp-section lp-contact" id="aloqa">
            <div className="lp-contact-panel" data-lp-reveal>
              <div className="lp-contact-main">
                <span className="lp-section-kicker">{COMPANY}</span>
                <h2>{t("Biz bilan bog'laning")}</h2>
                <p>{t("Demo, integratsiya yoki maxsus tarif bo'yicha yozing — ish kunida javob beramiz.")}</p>
                <div className="lp-cta-row">
                  <a className="lp-btn lp-btn-primary" href={`mailto:${CONTACT_EMAIL}`}>
                    <Mail size={16} />
                    {t("Email yozish")}
                  </a>
                  <button type="button" className="lp-btn lp-btn-soft" onClick={() => go(ctaHref)}>
                    {ctaLabel}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
              <aside>
                <div className="lp-contact-row">
                  <Mail size={16} />
                  <div>
                    <span>{t("Email")}</span>
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  </div>
                </div>
                <div className="lp-contact-row">
                  <ShieldCheck size={16} />
                  <div>
                    <span>{PRODUCT}</span>
                    <strong>{t("Yuridik hujjat AI platformasi")}</strong>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div>
            <strong>{PRODUCT}</strong>
            <span>
              © 2026 {COMPANY}. {t("Barcha huquqlar himoyalangan.")}
            </span>
          </div>
          <nav aria-label="Footer">
            <button type="button" onClick={() => go(authed ? "/dashboard" : "/login")}>
              {authed ? t("Dashboard") : t("Kirish")}
            </button>
            {!authed ? (
              <button type="button" onClick={() => go("/register")}>
                {t("Bepul boshlash")}
              </button>
            ) : null}
            <a href={`mailto:${CONTACT_EMAIL}`}>{t("Aloqa")}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
