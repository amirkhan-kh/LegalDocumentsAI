export type AuthUser = {
  username: string;
  displayName: string;
  role: "admin";
  initials: string;
};

export type AuthSession = {
  user: AuthUser;
  csrfToken: string;
  expiresAt: string;
};

export type LoginChallenge = {
  challengeToken: string;
  expiresAt: string;
  user: AuthUser;
  security: {
    sessionMinutes: number;
    protectedApi: boolean;
    httpOnlySession: boolean;
  };
};
