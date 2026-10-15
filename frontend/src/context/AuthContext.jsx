import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient, { TOKEN_KEY, UNAUTHORIZED_EVENT } from "../services/apiClient";
import { AuthContext } from "./authStore";

const EMPTY_ACCESS = { company: null, role: null, permissions: [] };

// Holds the signed-in user plus their company access: which company,
// which role, which permission keys. Permissions are used only to
// show/hide actions -- the API enforces every one of them itself.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(EMPTY_ACCESS);
  const [needsCompany, setNeedsCompany] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [sessionExpired, setSessionExpired] = useState(false);
  // True right after the user signed out on purpose: the login page then
  // starts fresh instead of sending the next person back to the previous
  // user's last page.
  const [loggedOut, setLoggedOut] = useState(false);
  // Bumped to re-run the context load (after login, onboarding, ...).
  const [version, setVersion] = useState(0);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setAccess(EMPTY_ACCESS);
    setNeedsCompany(false);
    setLoading(false);
  }, []);

  // Resolve the stored token into user + company access. Any failure to
  // confirm the token clears it rather than trusting it optimistically.
  // `ignore` guards StrictMode's dev-only double invoke.
  useEffect(() => {
    if (!token) return undefined;
    let ignore = false;

    async function loadContext() {
      try {
        const me = await apiClient.get("/users/me");
        if (ignore) return;

        const memberships = me.data.memberships || [];
        const hasActive = memberships.some((m) => m.status === "ACTIVE");

        let nextAccess = EMPTY_ACCESS;
        if (hasActive) {
          const perms = await apiClient.get("/companies/me/permissions");
          if (ignore) return;
          const data = perms.data.data;
          nextAccess = {
            company: { id: data.company_id, name: data.company_name },
            role: data.role,
            permissions: data.permissions,
          };
        }

        setUser(me.data.user);
        setAccess(nextAccess);
        setNeedsCompany(!hasActive);
        setLoading(false);
      } catch {
        if (!ignore) clearSession();
      }
    }

    loadContext();

    return () => {
      ignore = true;
    };
  }, [token, version, clearSession]);

  // Global 401 handling (see apiClient): sign out and let the login page
  // explain why.
  useEffect(() => {
    function handleUnauthorized() {
      clearSession();
      setSessionExpired(true);
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [clearSession]);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setSessionExpired(false);
    setLoggedOut(false);
    if (userData) setUser(userData);
    setLoading(true);
    setToken(newToken);
    setVersion((v) => v + 1);
  }, []);

  const logout = useCallback(() => {
    setSessionExpired(false);
    setLoggedOut(true);
    clearSession();
  }, [clearSession]);

  // Re-read the context, e.g. after creating a company.
  const refresh = useCallback(() => {
    setLoading(true);
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo(() => {
    const permissionSet = new Set(access.permissions);
    return {
      token,
      user,
      company: access.company,
      role: access.role,
      permissions: access.permissions,
      can: (key) => permissionSet.has(key),
      needsCompany,
      isAuthenticated: Boolean(token),
      loading,
      sessionExpired,
      loggedOut,
      login,
      logout,
      refresh,
    };
  }, [token, user, access, needsCompany, loading, sessionExpired, loggedOut, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
