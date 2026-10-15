import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authStore";
import { ROLE_LABELS } from "../utils/labels";
import "./AppLayout.css";

// `permission` hides a link the user can't use anyway (the API would
// answer 403); it is a convenience, not the access control.
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", permission: "reports.read" },
  { to: "/customers", label: "Müşteriler", permission: "participants.read" },
  { to: "/tours", label: "Turlar", permission: "tours.read" },
  { to: "/flights", label: "Uçuşlar", permission: "flights.read" },
  { to: "/hotels", label: "Oteller", permission: "hotels.read" },
  { to: "/activities", label: "Aktiviteler", permission: "activities.read" },
  { to: "/finance", label: "Finans", permission: "finance.read" },
  { to: "/documents", label: "Belgeler", permission: "documents.read" },
  { to: "/announcements", label: "Duyurular", permission: "announcements.read" },
  { to: "/settings", label: "Ayarlar" },
];

function AppLayout() {
  const { user, company, role, can, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-brand">TripFlow</div>
        {company && <div className="app-company">{company.name}</div>}
        <nav className="app-nav" aria-label="Ana menü">
          {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "app-nav-link app-nav-link-active" : "app-nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <span className="app-header-title">{company?.name || "TripFlow"}</span>
          <div className="app-header-user">
            <div className="app-user">
              {user?.name && <span className="app-user-name">{user.name}</span>}
              {role && <span className="app-user-role">{ROLE_LABELS[role] || role}</span>}
            </div>
            <button type="button" className="app-logout" onClick={handleLogout}>
              Çıkış Yap
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
