import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import Field from "../components/ui/Field";
import "./AuthPages.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading, sessionExpired } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already signed in (e.g. opened /login in a new tab): go straight in.
  if (isAuthenticated && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("E-posta ve şifre zorunludur.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/users/login", { email, password });
      login(response.data.token, response.data.user);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response
          ? err.response.data?.message || "Giriş yapılırken bir hata oluştu."
          : "Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">TripFlow</p>
        <h1>Giriş yap</h1>
        <p className="auth-subtitle">Tur operasyonlarınızı tek yerden yönetin.</p>

        {sessionExpired && (
          <p className="auth-notice">Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field label="E-posta">
            {(id) => (
              <input
                id={id}
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <Field label="Şifre">
            {(id) => (
              <input
                id={id}
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p className="auth-footer">
          Hesabın yok mu? <Link to="/register">Kayıt ol</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
