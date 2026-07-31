import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { LanguageSwitcher, useI18n } from "../../app/i18n";
import { closeSession, fetchAuthSession, requestLogin, requestRegister, verifyLogin } from "./api";
import { clearCsrfToken, setCsrfToken } from "./csrf";
import type { AuthSession, LoginChallenge } from "./types";
import { LandingPage } from "../marketing/LandingPage";
import { SuperAdminPage } from "../saas/SuperAdminPage";

type AuthContextValue = {
  session: AuthSession;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PREFIXES = ["/", "/login", "/register"] as const;

function pathOf(): string {
  return window.location.pathname || "/";
}

function isLandingPath(pathname: string) {
  return pathname === "/" || pathname === "";
}

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function isRegisterPath(pathname: string) {
  return pathname === "/register" || pathname.startsWith("/register/");
}

function isSuperAdminPath(pathname: string) {
  return pathname === "/super-admin" || pathname.startsWith("/super-admin/");
}

function isPublicPath(pathname: string) {
  return isLandingPath(pathname) || isLoginPath(pathname) || isRegisterPath(pathname);
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [path, setPath] = useState(() => pathOf());

  useEffect(() => {
    const syncPath = () => setPath(pathOf());
    window.addEventListener("popstate", syncPath);
    window.addEventListener("legalai:navigate", syncPath);
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener("legalai:navigate", syncPath);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    void fetchAuthSession()
      .then((current) => {
        if (!isMounted) return;
        if (current) {
          setCsrfToken(current.csrfToken);
          setSession(current);
          if (isLoginPath(pathOf()) || isRegisterPath(pathOf())) {
            window.history.replaceState({}, "", "/dashboard");
            setPath("/dashboard");
          }
        } else {
          clearCsrfToken();
          setSession(null);
          if (!isPublicPath(pathOf())) {
            window.history.replaceState({}, "", "/login");
            setPath("/login");
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        clearCsrfToken();
        setSession(null);
        if (!isPublicPath(pathOf())) {
          window.history.replaceState({}, "", "/login");
          setPath("/login");
        }
      })
      .finally(() => isMounted && setIsChecking(false));

    const handleUnauthorized = () => {
      clearCsrfToken();
      setSession(null);
      window.history.replaceState({}, "", "/login");
      setPath("/login");
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

  const navigate = (next: string) => {
    const url = next.startsWith("/") ? next : `/${next}`;
    if (pathOf() !== url.split("?")[0] || window.location.search !== (url.includes("?") ? `?${url.split("?")[1]}` : "")) {
      window.history.pushState({}, "", url);
    }
    setPath(url.split("?")[0] || "/");
    window.dispatchEvent(new Event("legalai:navigate"));
  };

  if (isChecking) return <SessionSplash />;

  if (!session) {
    if (isLandingPath(path)) {
      return <LandingPage session={null} onNavigate={navigate} />;
    }
    if (isRegisterPath(path)) {
      return (
        <RegisterPage
          onAuthenticated={(nextSession) => {
            setCsrfToken(nextSession.csrfToken);
            setSession(nextSession);
            navigate("/dashboard");
          }}
          onNavigate={navigate}
        />
      );
    }
    return (
      <LoginPage
        onAuthenticated={(nextSession) => {
          setCsrfToken(nextSession.csrfToken);
          setSession(nextSession);
          navigate("/dashboard");
        }}
        onNavigate={navigate}
      />
    );
  }

  const logout = async () => {
    try {
      await closeSession(session.csrfToken);
    } finally {
      clearCsrfToken();
      setSession(null);
      navigate("/");
    }
  };

  if (isLandingPath(path)) {
    return (
      <AuthContext.Provider value={{ session, logout }}>
        <LandingPage session={session} onNavigate={navigate} />
      </AuthContext.Provider>
    );
  }

  if (isSuperAdminPath(path)) {
    if (!session.user.isSuperAdmin && session.user.role !== "super_admin") {
      navigate("/dashboard");
      return <SessionSplash />;
    }
    return (
      <AuthContext.Provider value={{ session, logout }}>
        <SuperAdminPage session={session} onNavigate={navigate} />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={{ session, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthBoundary");
  return value;
}

function LoginPage({
  onAuthenticated,
  onNavigate,
}: {
  onAuthenticated: (session: AuthSession) => void;
  onNavigate: (path: string) => void;
}) {
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
      setError(requestError instanceof Error ? requestError.message : t("Kirish bajarilmadi."));
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
      setError(requestError instanceof Error ? requestError.message : t("Tasdiqlash bajarilmadi."));
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
          <button type="button" className="auth-brand auth-brand-link" onClick={() => onNavigate("/")}>
            <span className="brand-orb">
              <ShieldCheck size={17} />
            </span>
            <strong>LegalAI</strong>
          </button>
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
              {t("Login yoki email")}
              <span className="auth-input">
                <UserRound size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  spellCheck={false}
                  autoFocus
                />
              </span>
            </label>
            <label>
              {t("Parol")}
              <span className="auth-input">
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={t(showPassword ? "Parolni yashirish" : "Parolni ko'rsatish")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="spin" size={18} /> {t("Kirish ma'lumotlari tekshirilmoqda...")}
                </>
              ) : (
                <>
                  {t("Davom etish")} <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="auth-switch">
              {t("Hisobingiz yo'qmi?")}{" "}
              <button type="button" onClick={() => onNavigate("/register")}>
                {t("3 kun bepul sinab ko'ring")}
              </button>
            </p>
          </form>
        ) : (
          <div className="auth-form auth-confirmation">
            <div className="auth-confirm-icon">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="auth-eyebrow">{t("Shaxs tasdiqlandi")}</p>
              <h1 id="login-title">{t("Ishchi sessiyani tasdiqlash")}</h1>
              <p className="auth-subtitle">{t("Sessiyani boshlashdan oldin xavfsizlik parametrlarini tekshiring.")}</p>
            </div>
            <div className="auth-user-preview">
              <span>{challenge.user.initials}</span>
              <div>
                <strong>{challenge.user.displayName}</strong>
                <small>@{challenge.user.username}</small>
              </div>
            </div>
            <div className="auth-security-grid">
              <div>
                <span>{t("Rol")}</span>
                <strong>
                  {challenge.user.isSuperAdmin || challenge.user.role === "super_admin"
                    ? t("Super Admin")
                    : t("Foydalanuvchi")}
                </strong>
              </div>
              <div>
                <span>{t("Sessiya")}</span>
                <strong>{t("8 soat")}</strong>
              </div>
              <div>
                <span>{t("Himoya")}</span>
                <strong>{t("HttpOnly + CSRF")}</strong>
              </div>
            </div>
            <label className="auth-consent">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>{t("Maxfiy hujjatlar bilan ishlash siyosatini qabul qilaman.")}</span>
            </label>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <div className="auth-confirm-actions">
              <button
                type="button"
                className="auth-back"
                onClick={() => {
                  setChallenge(null);
                  setAccepted(false);
                  setError("");
                }}
                disabled={isSubmitting}
              >
                <ArrowLeft size={17} /> {t("Orqaga")}
              </button>
              <button type="button" className="auth-submit" onClick={confirmSession} disabled={!accepted || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="spin" size={18} /> {t("Xavfsizlik tasdiqlanmoqda...")}
                  </>
                ) : (
                  <>
                    {t("Sessiyani boshlash")} <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function RegisterPage({
  onAuthenticated,
  onNavigate,
}: {
  onAuthenticated: (session: AuthSession) => void;
  onNavigate: (path: string) => void;
}) {
  const { t } = useI18n();
  const preferredPlan = (() => {
    try {
      return new URLSearchParams(window.location.search).get("plan") || "growth";
    } catch {
      return "growth";
    }
  })();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submitRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password || !organizationName.trim()) {
      setError(t("Login, parol va tashkilot nomini to'ldiring."));
      return;
    }
    if (password.length < 8) {
      setError(t("Parol kamida 8 ta belgi bo'lishi kerak."));
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      setChallenge(
        await requestRegister({
          email: email.trim(),
          password,
          fullName: fullName.trim() || undefined,
          organizationName: organizationName.trim(),
          preferredPlan,
        }),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("Ro'yxatdan o'tish bajarilmadi."));
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
      setError(requestError instanceof Error ? requestError.message : t("Tasdiqlash bajarilmadi."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card auth-card-wide" aria-labelledby="register-title">
        <div className="auth-card-topline" />
        <header className="auth-brand-row">
          <button type="button" className="auth-brand auth-brand-link" onClick={() => onNavigate("/")}>
            <span className="brand-orb">
              <ShieldCheck size={17} />
            </span>
            <strong>LegalAI</strong>
          </button>
          <LanguageSwitcher compact />
        </header>

        {!challenge ? (
          <form onSubmit={submitRegister} className="auth-form">
            <div>
              <p className="auth-eyebrow">{t("3 KUN BEPUL")}</p>
              <h1 id="register-title">{t("Ro'yxatdan o'tish")}</h1>
              <p className="auth-subtitle">
                {t("Tashkilotingizni yarating va yuridik hujjat AI ni sinab ko'ring.")}
              </p>
            </div>
            <label>
              {t("Tashkilot nomi")}
              <span className="auth-input">
                <Building2 size={18} />
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  autoComplete="organization"
                  autoFocus
                />
              </span>
            </label>
            <label>
              {t("To'liq ism")}
              <span className="auth-input">
                <UserRound size={18} />
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
              </span>
            </label>
            <label>
              {t("Login yoki email")}
              <span className="auth-input">
                <Mail size={18} />
                <input
                  type="text"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  spellCheck={false}
                />
              </span>
            </label>
            <label>
              {t("Parol")}
              <span className="auth-input">
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={t(showPassword ? "Parolni yashirish" : "Parolni ko'rsatish")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="spin" size={18} /> {t("Hisob yaratilmoqda...")}
                </>
              ) : (
                <>
                  {t("Bepul boshlash")} <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="auth-switch">
              {t("Allaqachon hisobingiz bormi?")}{" "}
              <button type="button" onClick={() => onNavigate("/login")}>
                {t("Kirish")}
              </button>
            </p>
          </form>
        ) : (
          <div className="auth-form auth-confirmation">
            <div className="auth-confirm-icon">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="auth-eyebrow">{t("Hisob yaratildi")}</p>
              <h1 id="register-title">{t("Ishchi sessiyani tasdiqlash")}</h1>
              <p className="auth-subtitle">
                {t("3 kunlik bepul sinov boshlandi. Maxfiy hujjat siyosatini qabul qiling.")}
              </p>
            </div>
            <div className="auth-user-preview">
              <span>{challenge.user.initials}</span>
              <div>
                <strong>{challenge.user.displayName}</strong>
                <small>@{challenge.user.username}</small>
              </div>
            </div>
            <label className="auth-consent">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>{t("Maxfiy hujjatlar bilan ishlash siyosatini qabul qilaman.")}</span>
            </label>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <div className="auth-confirm-actions">
              <button type="button" className="auth-submit" onClick={confirmSession} disabled={!accepted || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="spin" size={18} /> {t("Xavfsizlik tasdiqlanmoqda...")}
                  </>
                ) : (
                  <>
                    {t("Dashboardga o'tish")} <ArrowRight size={18} />
                  </>
                )}
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
      <span className="brand-orb large">
        <ShieldCheck size={24} />
      </span>
      <LoaderCircle className="spin" size={22} />
      <strong>{t("Sessiya tekshirilmoqda")}</strong>
    </main>
  );
}

// silence unused constant lint if any
void PUBLIC_PREFIXES;
