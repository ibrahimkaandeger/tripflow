import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import Field from "../components/ui/Field";
import "./AuthPages.css";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Creates the account and, when a company name is given, the company
// with this user as its OWNER in the same request.
function Register() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", password: "", passwordConfirm: "", companyName: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function validate() {
    if (!form.name.trim() || !form.email.trim() || !form.password) return "Ad, e-posta ve şifre zorunludur.";
    if (!EMAIL_PATTERN.test(form.email.trim())) return "Geçerli bir e-posta adresi girin.";
    if (form.password.length < MIN_PASSWORD_LENGTH) return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
    if (form.password !== form.passwordConfirm) return "Şifreler eşleşmiyor.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post("/users/", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        companyName: form.companyName.trim() || undefined,
      });
      login(response.data.token, response.data.user);
      navigate(response.data.company ? "/dashboard" : "/onboarding", { replace: true });
    } catch (err) {
      setError(
        err.response
          ? err.response.data?.message || "Kayıt olurken bir hata oluştu."
          : "Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">TripFlow</p>
        <h1>Hesap oluştur</h1>
        <p className="auth-subtitle">Şirketinizi oluşturun ve ekibinizle tur operasyonlarını yönetin.</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field label="Ad Soyad" required>
            {(id) => <input id={id} className="input" autoComplete="name" value={form.name} onChange={update("name")} />}
          </Field>
          <Field label="E-posta" required>
            {(id) => (
              <input id={id} className="input" type="email" autoComplete="email" value={form.email} onChange={update("email")} />
            )}
          </Field>
          <Field label="Şifre" required hint={`En az ${MIN_PASSWORD_LENGTH} karakter.`}>
            {(id) => (
              <input
                id={id}
                className="input"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={update("password")}
              />
            )}
          </Field>
          <Field label="Şifre (tekrar)" required>
            {(id) => (
              <input
                id={id}
                className="input"
                type="password"
                autoComplete="new-password"
                value={form.passwordConfirm}
                onChange={update("passwordConfirm")}
              />
            )}
          </Field>
          <Field label="Şirket adı" hint="Bir ekibe katılacaksanız boş bırakabilirsiniz.">
            {(id) => (
              <input id={id} className="input" autoComplete="organization" value={form.companyName} onChange={update("companyName")} />
            )}
          </Field>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Hesap oluşturuluyor..." : "Kayıt Ol"}
          </button>
        </form>

        <p className="auth-footer">
          Zaten hesabın var mı? <Link to="/login">Giriş yap</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
