import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, FileLock2, LoaderCircle, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { LanguageSwitcher, useI18n } from "../../app/i18n";
import { closeSession, fetchAuthSession, requestLogin, verifyLogin } from "./api";
import { clearCsrfToken, setCsrfToken } from "./csrf";
import type { AuthSession, LoginChallenge } from "./types";

type AuthContextValue = {
  session: AuthSession;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void fetchAuthSession()
      .then((current) => {
        if (!isMounted) return;
        if (current) {
          setCsrfToken(current.csrfToken);
          setSession(current);
          if (window.location.pathname === "/login") window.history.replaceState({}, "", "/dashboard");
        } else {
          clearCsrfToken();
          if (window.location.pathname !== "/login") window.history.replaceState({}, "", "/login");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        clearCsrfToken();
        setSession(null);
        if (window.location.pathname !== "/login") window.history.replaceState({}, "", "/login");
      })
      .finally(() => isMounted && setIsChecking(false));
    const handleUnauthorized = () => {
      clearCsrfToken();
      setSession(null);
      window.history.replaceState({}, "", "/login");
    };
    window.addEventListener("legalai:unauthorized", handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener("legalai:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const remainingMs = new Date(session.expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      window.dispatchEvent(new Event("legalai:unauthorized"));
      return undefined;
    }
    const timeout = window.setTimeout(() => window.dispatchEvent(new Event("legalai:unauthorized")), remainingMs);
    return () => window.clearTimeout(timeout);
  }, [session]);

  if (isChecking) return <SessionSplash />;
  if (!session) {
    return (
      <LoginPage
        onAuthenticated={(nextSession) => {
          setCsrfToken(nextSession.csrfToken);
          setSession(nextSession);
          window.history.replaceState({}, "", "/dashboard");
        }}
      />
    );
  }

  const logout = async () => {
    try {
      await closeSession(session.csrfToken);
    } finally {
      clearCsrfToken();
      setSession(null);
      window.history.replaceState({}, "", "/login");
    }
  };

  return <AuthContext.Provider value={{ session, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthBoundary");
  return value;
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError(t("Login va parolni kiriting."));
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      setChallenge(await requestLogin(username, password));
    } catch (requestError) {
      setError(requestError instanceof Error ? t(requestError.message) : t("Kirish bajarilmadi."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSession = async () => {
    if (!challenge || !accepted) return;
    setIsSubmitting(true);
    setError("");
    try {
      onAuthenticated(await verifyLogin(challenge.challengeToken));
    } catch (requestError) {
      setError(requestError instanceof Error ? t(requestError.message) : t("Tasdiqlash bajarilmadi."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-card-topline" />
        <header className="auth-brand-row">
          <div className="auth-brand">
            <span className="brand-orb"><ShieldCheck size={17} /></span>
            <strong>LegalAI</strong>
          </div>
          <LanguageSwitcher compact />
        </header>

        {!challenge ? (
          <form onSubmit={submitCredentials} className="auth-form">
            <div>
              <p className="auth-eyebrow">{t("ADMIN ACCESS")}</p>
              <h1 id="login-title">{t("Kirish")}</h1>
              <p className="auth-subtitle">{t("LegalAI boshqaruv paneliga xavfsiz kirish.")}</p>
            </div>
            <label>
              {t("Login")}
              <span className="auth-input">
                <UserRound size={18} />
                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus />
              </span>
            </label>
            <label>
              {t("Parol")}
              <span className="auth-input">
                <LockKeyhole size={18} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={t(showPassword ? "Parolni yashirish" : "Parolni ko'rsatish")}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? <><LoaderCircle className="spin" size={18} /> {t("Kirish ma'lumotlari tekshirilmoqda...")}</> : <>{t("Davom etish")} <ArrowRight size={18} /></>}
            </button>
            <div className="auth-security-note"><FileLock2 size={16} /> HttpOnly session · CSRF · rate limit</div>
          </form>
        ) : (
          <div className="auth-form auth-confirmation">
            <div className="auth-confirm-icon"><CheckCircle2 size={24} /></div>
            <div>
              <p className="auth-eyebrow">{t("Shaxs tasdiqlandi")}</p>
              <h1 id="login-title">{t("Ishchi sessiyani tasdiqlash")}</h1>
              <p className="auth-subtitle">{t("Sessiyani boshlashdan oldin xavfsizlik parametrlarini tekshiring.")}</p>
            </div>
            <div className="auth-user-preview">
              <span>{challenge.user.initials}</span>
              <div><strong>{challenge.user.displayName}</strong><small>@{challenge.user.username}</small></div>
            </div>
            <div className="auth-security-grid">
              <div><span>{t("Rol")}</span><strong>{t("Administrator")}</strong></div>
              <div><span>{t("Sessiya")}</span><strong>{t("8 soat")}</strong></div>
              <div><span>{t("Himoya")}</span><strong>{t("HttpOnly + CSRF")}</strong></div>
            </div>
            <label className="auth-consent">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>{t("Maxfiy hujjatlar bilan ishlash siyosatini qabul qilaman.")}</span>
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <div className="auth-confirm-actions">
              <button type="button" className="auth-back" onClick={() => { setChallenge(null); setAccepted(false); setError(""); }} disabled={isSubmitting}>
                <ArrowLeft size={17} /> {t("Orqaga")}
              </button>
              <button type="button" className="auth-submit" onClick={confirmSession} disabled={!accepted || isSubmitting}>
                {isSubmitting ? <><LoaderCircle className="spin" size={18} /> {t("Xavfsizlik tasdiqlanmoqda...")}</> : <>{t("Sessiyani boshlash")} <ArrowRight size={18} /></>}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function SessionSplash() {
  const { t } = useI18n();
  return (
    <main className="session-splash">
      <span className="brand-orb large"><ShieldCheck size={24} /></span>
      <LoaderCircle className="spin" size={22} />
      <strong>{t("Sessiya tekshirilmoqda")}</strong>
    </main>
  );
}
