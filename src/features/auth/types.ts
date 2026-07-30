export type AuthRole = "super_admin" | "owner" | "admin" | "member" | "viewer" | "admin";

export type AuthUser = {
  id?: string;
  username: string;
  email?: string;
  displayName: string;
  role: AuthRole | string;
  isSuperAdmin?: boolean;
  initials: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationStatus?: string | null;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  status: string;
  trialEndsAt?: string | null;
  planCode?: string;
  plan?: {
    code: string;
    name: string;
    priceUsd: number;
    analysesMonthly: number;
  } | null;
  usage?: {
    yearMonth: string;
    analyses: number;
    limit: number;
  };
};

export type AuthSession = {
  user: AuthUser;
  csrfToken: string;
  expiresAt: string;
  organization?: OrganizationSummary | null;
  trialDays?: number;
};

export type LoginChallenge = {
  challengeToken: string;
  expiresAt: string;
  user: AuthUser;
  organization?: OrganizationSummary | null;
  trialDays?: number;
  security: {
    sessionMinutes: number;
    protectedApi: boolean;
    httpOnlySession: boolean;
  };
};

export type PublicPlan = {
  id: string;
  code: string;
  name: string;
  priceUsd: number;
  analysesMonthly: number;
  seats: number;
  blurb: string;
  features: string[];
  popular: boolean;
  sortOrder: number;
};

export type SuperAdminOrg = {
  id: string;
  name: string;
  slug: string;
  status: string;
  trialEndsAt?: string | null;
  planCode?: string;
  preferredPlanCode?: string;
  plan?: { code: string; name: string; priceUsd: number; analysesMonthly: number } | null;
  usage?: { yearMonth: string; analyses: number; limit: number };
  owner?: { id: string; email: string; fullName: string } | null;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
};
