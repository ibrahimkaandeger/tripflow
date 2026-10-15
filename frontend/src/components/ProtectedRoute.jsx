import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/authStore";
import { LoadingState } from "./ui/States";

// Gate for every signed-in page. A user without a company is sent to
// onboarding first (every business endpoint needs a company context).
function ProtectedRoute({ children, allowWithoutCompany = false }) {
  const { isAuthenticated, loading, needsCompany, loggedOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Oturum doğrulanıyor..." />;
  }

  if (!isAuthenticated) {
    // Remember where to return only for deep links / expired sessions,
    // never after a deliberate logout.
    return <Navigate to="/login" replace state={loggedOut ? undefined : { from: location.pathname + location.search }} />;
  }

  if (needsCompany && !allowWithoutCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export default ProtectedRoute;
