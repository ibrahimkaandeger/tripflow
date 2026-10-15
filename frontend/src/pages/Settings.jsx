import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import { useSubmit } from "../hooks/useSubmit";
import Field from "../components/ui/Field";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { toPayload } from "../utils/formPayload";
import { MEMBER_STATUS, ROLE_LABELS } from "../utils/labels";
import { formatDate } from "../utils/date";

const COMPANY_FIELDS = [
  ["name", "Şirket adı", 200],
  ["legal_name", "Ticari unvan", 200],
  ["email", "E-posta", 255],
  ["phone", "Telefon", 50],
  ["website", "Web sitesi", 255],
  ["tax_number", "Vergi no", 50],
  ["city", "Şehir", 100],
  ["country", "Ülke", 100],
];

function roleName(role) {
  return ROLE_LABELS[role?.name ?? role] || role?.name || role || "-";
}

function CompanySettings() {
  const { can, refresh } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => apiClient.get("/companies/me"), "company-me");
  const company = data?.data;
  const editable = can("company.update");

  if (loading && !company) return <LoadingState label="Şirket bilgileri yükleniyor..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!company) return null;

  return (
    <CompanyForm
      key={company.updated_at}
      company={company}
      editable={editable}
      onSaved={() => {
        toast.success("Şirket bilgileri güncellendi.");
        reload();
        refresh();
      }}
    />
  );
}

function CompanyForm({ company, editable, onSaved }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries([...COMPANY_FIELDS.map(([field]) => field), "address"].map((field) => [field, company[field] || ""]))
  );
  const { busy, error, setError, run } = useSubmit();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("Şirket adı zorunludur.");
      return;
    }
    const ok = await run(() => apiClient.patch("/companies/me", toPayload(values, { editing: true })));
    if (ok) onSaved();
  }

  return (
    <section className="card">
      <h2>Şirket Bilgileri</h2>
      {!editable && <p className="muted small">Şirket bilgilerini değiştirme yetkiniz yok.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {COMPANY_FIELDS.map(([field, label, max]) => (
            <Field key={field} label={label} required={field === "name"}>
              {(id) => (
                <input
                  id={id}
                  className="input"
                  value={values[field]}
                  maxLength={max}
                  disabled={!editable}
                  onChange={(event) => setValues((v) => ({ ...v, [field]: event.target.value }))}
                />
              )}
            </Field>
          ))}
          <Field label="Adres" className="span-2">
            {(id) => (
              <textarea
                id={id}
                className="textarea"
                value={values.address}
                disabled={!editable}
                onChange={(event) => setValues((v) => ({ ...v, address: event.target.value }))}
              />
            )}
          </Field>
        </div>
        {editable && (
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function MemberModal({ member, roles, onClose, onSaved }) {
  const editing = Boolean(member);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(member ? String(member.role_id) : "");
  const [status, setStatus] = useState(member?.status || "ACTIVE");
  const { busy, error, setError, run } = useSubmit();

  async function handleSubmit(event) {
    event.preventDefault();
    if ((!editing && !email.trim()) || !roleId) {
      setError(editing ? "Bir rol seçin." : "E-posta ve rol zorunludur.");
      return;
    }
    const ok = await run(() =>
      editing
        ? apiClient.patch(`/company-users/${member.id}`, { role_id: Number(roleId), status })
        : apiClient.post("/company-users", { email: email.trim(), role_id: Number(roleId) })
    );
    if (ok) onSaved(editing);
  }

  return (
    <Modal title={editing ? `${member.name} · Üyeliği Düzenle` : "Ekip Üyesi Ekle"} onClose={onClose} width={500}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {!editing && (
            <Field label="E-posta" required className="span-2" hint="Kişinin önce TripFlow'a bu e-posta ile kayıt olması gerekir.">
              {(id) => <input id={id} className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
            </Field>
          )}
          <Field label="Rol" required className={editing ? "" : "span-2"}>
            {(id) => (
              <select id={id} className="select" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                <option value="">Rol seçin</option>
                {roles.map((role) => (
                  <option key={role.id} value={String(role.id)}>
                    {roleName(role)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {editing && (
            <Field label="Durum">
              {(id) => (
                <select id={id} className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
                  {Object.entries(MEMBER_STATUS).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Kaydediliyor..." : editing ? "Kaydet" : "Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TeamSettings() {
  const { user, can } = useAuth();
  const toast = useToast();
  const members = useApi(() => apiClient.get("/company-users", { params: { limit: 100 } }), "company-users");
  const roles = useApi(() => apiClient.get("/roles"), can("roles.read") ? "roles" : null);
  const [modal, setModal] = useState(null);

  const rows = members.data?.data || [];
  const roleList = roles.data?.data || [];

  return (
    <section className="card">
      <div className="section-head">
        <h2>Ekip</h2>
        {can("users.create") && roleList.length > 0 && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({})}>
            + Üye Ekle
          </button>
        )}
      </div>
      {members.loading && !members.data ? (
        <LoadingState label="Ekip yükleniyor..." />
      ) : members.error ? (
        <ErrorState message={members.error} onRetry={members.reload} />
      ) : rows.length === 0 ? (
        <EmptyState title="Ekip üyesi yok." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Üye</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Katılma</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.id}>
                  <td className="cell-strong">
                    {member.name}
                    {member.user_id === user?.id && <span className="muted small"> (siz)</span>}
                    <span className="cell-sub">{member.email}</span>
                  </td>
                  <td>{roleName(member.role_name)}</td>
                  <td>
                    <StatusBadge map={MEMBER_STATUS} value={member.status} />
                  </td>
                  <td>{formatDate(member.created_at)}</td>
                  <td className="cell-actions">
                    {can("users.update") && member.user_id !== user?.id && roleList.length > 0 && (
                      <button type="button" className="btn-link" onClick={() => setModal({ member })}>
                        Düzenle
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <MemberModal
          member={modal.member || null}
          roles={roleList}
          onClose={() => setModal(null)}
          onSaved={(edited) => {
            setModal(null);
            toast.success(edited ? "Üyelik güncellendi." : "Ekip üyesi eklendi.");
            members.reload();
          }}
        />
      )}
    </section>
  );
}

function RolesSettings() {
  const roles = useApi(() => apiClient.get("/roles"), "roles-list");
  const [openRole, setOpenRole] = useState(null);
  const permissions = useApi(() => apiClient.get(`/roles/${openRole}/permissions`), openRole ? `role-perms-${openRole}` : null);
  const list = roles.data?.data || [];

  return (
    <section className="card">
      <h2>Roller ve Yetkiler</h2>
      {roles.loading && !roles.data ? (
        <LoadingState />
      ) : roles.error ? (
        <ErrorState message={roles.error} onRetry={roles.reload} />
      ) : (
        <ul className="role-list">
          {list.map((role) => (
            <li key={role.id}>
              <button type="button" className="role-toggle" onClick={() => setOpenRole(openRole === role.id ? null : role.id)} aria-expanded={openRole === role.id}>
                <span className="cell-strong">{roleName(role)}</span>
                <span className="muted small">{role.description}</span>
              </button>
              {openRole === role.id && (
                <div className="role-permissions">
                  {permissions.loading ? (
                    <LoadingState />
                  ) : permissions.error ? (
                    <p className="state-error">{permissions.error}</p>
                  ) : (
                    (permissions.data?.data || []).map((perm) => (
                      <span key={perm.key} className="badge" title={perm.description}>
                        {perm.key}
                      </span>
                    ))
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AccountSettings() {
  const { user, company, role, logout } = useAuth();
  return (
    <section className="card">
      <h2>Hesabım</h2>
      <dl className="detail-grid">
        <div>
          <dt>Ad</dt>
          <dd>{user?.name}</dd>
        </div>
        <div>
          <dt>E-posta</dt>
          <dd>{user?.email}</dd>
        </div>
        <div>
          <dt>Şirket</dt>
          <dd>{company?.name || "-"}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>{roleName(role)}</dd>
        </div>
      </dl>
      <div className="form-actions">
        <button type="button" className="btn" onClick={logout}>
          Çıkış Yap
        </button>
      </div>
    </section>
  );
}

const TABS = [
  { key: "company", label: "Şirket", permission: "company.read", render: () => <CompanySettings /> },
  { key: "team", label: "Ekip", permission: "users.read", render: () => <TeamSettings /> },
  { key: "roles", label: "Roller", permission: "roles.read", render: () => <RolesSettings /> },
  { key: "account", label: "Hesabım", render: () => <AccountSettings /> },
];

function Settings() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter((tab) => !tab.permission || can(tab.permission));
  const active = tabs.find((tab) => tab.key === searchParams.get("tab")) || tabs[0];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Ayarlar</h1>
          <p className="page-subtitle">Şirket profili, ekip üyeleri ve roller.</p>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Ayarlar bölümleri">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active.key === tab.key}
            className={active.key === tab.key ? "tab tab-active" : "tab"}
            onClick={() => setSearchParams({ tab: tab.key }, { replace: true })}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {active.render()}
    </div>
  );
}

export default Settings;
