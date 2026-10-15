import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Tours from "./pages/Tours";
import TourDetail from "./pages/TourDetail";
import Flights from "./pages/Flights";
import Hotels from "./pages/Hotels";
import Activities from "./pages/Activities";
import Finance from "./pages/Finance";
import Documents from "./pages/Documents";
import Announcements from "./pages/Announcements";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute allowWithoutCompany>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* Signed-in pages share the sidebar/header layout; add new ones here. */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/tours" element={<Tours />} />
        <Route path="/tours/:id" element={<TourDetail />} />
        <Route path="/flights" element={<Flights />} />
        <Route path="/hotels" element={<Hotels />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/settings" element={<Settings />} />

        {/* Earlier URLs kept working. */}
        <Route path="/participants" element={<Navigate to="/customers" replace />} />
        <Route path="/company" element={<Navigate to="/settings?tab=company" replace />} />
        <Route path="/staff" element={<Navigate to="/settings?tab=team" replace />} />
        <Route path="/roles" element={<Navigate to="/settings?tab=roles" replace />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
