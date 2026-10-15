import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { describeApiError } from "../utils/apiError";
import Field from "../components/ui/Field";
import "./AuthPages.css";

// Shown to a signed-in user who doesn't belong to any company yet.
// They can create their own (becoming its OWNER) or ask an existing
// company to add them by the email they registered with.
function Onboarding() {
  const navigate = useNavigate();
  const { user, needsCompany, refresh, logout } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!needsCompany) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Şirket adı zorunludur.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await apiClient.post("/companies", { name: name.trim() });
      refresh();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(describeApiError(err));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">TripFlow</p>
        <h1>Şirketinizi oluşturun</h1>
        <p className="auth-subtitle">
          Merhaba {user?.name}. Başlamak için şirketinizi oluşturun. Mevcut bir ekibe katılacaksanız, yöneticinizden
          sizi <strong>{user?.email}</strong> adresiyle eklemesini isteyin.
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field label="Şirket adı" required>
            {(id) => <input id={id} className="input" value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Oluşturuluyor..." : "Şirketi Oluştur"}
          </button>
        </form>

        <p className="auth-footer">
          <button type="button" className="btn-link" onClick={refresh}>
            Bir ekibe eklendim, tekrar kontrol et
          </button>
          {" · "}
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Çıkış yap
          </button>
        </p>
      </div>
    </div>
  );
}

export default Onboarding;
