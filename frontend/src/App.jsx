import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import AppShell from "./components/AppShell.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireKidsOnly from "./components/RequireKidsOnly.jsx";
import RequireKidsRedirect from "./components/RequireKidsRedirect.jsx";
import Home from "./pages/Home/Home.jsx";
import BudgetLayout from "./pages/Budget/BudgetLayout.jsx";
import BudgetIncome from "./pages/Budget/Income.jsx";
import BudgetExpenses from "./pages/Budget/Expenses.jsx";
import BudgetAllocations from "./pages/Budget/Allocations.jsx";
import BudgetSettings from "./pages/Budget/Settings.jsx";
import Login from "./pages/Login/Login.jsx";
import ResetPassword from "./pages/Login/ResetPassword.jsx";
import Shopping from "./pages/Shopping/Shopping.jsx";
import Settings from "./pages/Settings/Settings.jsx";
import Notifications from "./pages/Notifications/Notifications.jsx";
import HealthLayout from "./pages/Health/HealthLayout.jsx";
import HealthToday from "./pages/Health/Today.jsx";
import HealthLog from "./pages/Health/Log.jsx";
import HealthFoods from "./pages/Health/Foods.jsx";
import HealthInsights from "./pages/Health/Insights.jsx";
import KidsLayout from "./pages/Kids/KidsLayout.jsx";
import KidsHome from "./pages/Kids/KidsHome.jsx";
import KidsHistory from "./pages/Kids/KidsHistory.jsx";
import KidsAdmin from "./pages/Kids/KidsAdmin.jsx";
import LifeAdminLayout from "./pages/LifeAdmin/LifeAdminLayout.jsx";
import LifeAdminRecords from "./pages/LifeAdmin/Records.jsx";
import LifeAdminBuilder from "./pages/LifeAdmin/Builder.jsx";

const HealthHistoryRedirect = () => {
  const { date } = useParams();
  const target = date ? `/health/log?date=${encodeURIComponent(date)}` : "/health/log";
  return <Navigate to={target} replace />;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route
        element={
          <RequireAuth>
            <RequireKidsRedirect>
              <AppShell />
            </RequireKidsRedirect>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/budget" element={<BudgetLayout />}>
          <Route index element={<Navigate to="/budget/allocations" replace />} />
          <Route path="income" element={<BudgetIncome />} />
          <Route path="expenses" element={<BudgetExpenses />} />
          <Route path="allocations" element={<BudgetAllocations />} />
          <Route path="settings" element={<BudgetSettings />} />
        </Route>
        <Route path="/health" element={<HealthLayout />}>
          <Route index element={<Navigate to="/health/today" replace />} />
          <Route path="today" element={<HealthToday />} />
          <Route path="log" element={<HealthLog />} />
          <Route path="foods" element={<HealthFoods />} />
          <Route path="history" element={<HealthHistoryRedirect />} />
          <Route path="history/:date" element={<HealthHistoryRedirect />} />
          <Route path="insights" element={<HealthInsights />} />
        </Route>
        <Route path="/shopping" element={<Shopping />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/life-admin" element={<LifeAdminLayout />}>
          <Route index element={<Navigate to="/life-admin/records" replace />} />
          <Route path="records" element={<LifeAdminRecords />} />
          <Route path="builder" element={<LifeAdminBuilder />} />
        </Route>
        <Route path="/settings" element={<Settings />} />
        <Route path="/kids-admin" element={<KidsAdmin />} />
      </Route>
      <Route
        path="/kids"
        element={
          <RequireAuth>
            <RequireKidsOnly>
              <KidsLayout />
            </RequireKidsOnly>
          </RequireAuth>
        }
      >
        <Route index element={<KidsHome />} />
        <Route path="history" element={<KidsHistory />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
