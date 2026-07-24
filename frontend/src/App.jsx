import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import AppShell from "./components/AppShell.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireKidsOnly from "./components/RequireKidsOnly.jsx";
import RequireKidsRedirect from "./components/RequireKidsRedirect.jsx";

const Home = lazy(() => import("./pages/Home/Home.jsx"));
const BudgetLayout = lazy(() => import("./pages/Budget/BudgetLayout.jsx"));
const BudgetIncome = lazy(() => import("./pages/Budget/Income.jsx"));
const BudgetExpenses = lazy(() => import("./pages/Budget/Expenses.jsx"));
const BudgetAllocations = lazy(() => import("./pages/Budget/Allocations.jsx"));
const BudgetSettings = lazy(() => import("./pages/Budget/Settings.jsx"));
const Login = lazy(() => import("./pages/Login/Login.jsx"));
const CreateAccount = lazy(() => import("./pages/Login/CreateAccount.jsx"));
const ResetPassword = lazy(() => import("./pages/Login/ResetPassword.jsx"));
const Shopping = lazy(() => import("./pages/Shopping/Shopping.jsx"));
const Settings = lazy(() => import("./pages/Settings/Settings.jsx"));
const Notifications = lazy(() => import("./pages/Notifications/Notifications.jsx"));
const HealthLayout = lazy(() => import("./pages/Health/HealthLayout.jsx"));
const HealthToday = lazy(() => import("./pages/Health/Today.jsx"));
const HealthLog = lazy(() => import("./pages/Health/Log.jsx"));
const HealthFoods = lazy(() => import("./pages/Health/Foods.jsx"));
const HealthInsights = lazy(() => import("./pages/Health/Insights.jsx"));
const KidsLayout = lazy(() => import("./pages/Kids/KidsLayout.jsx"));
const KidsHome = lazy(() => import("./pages/Kids/KidsHome.jsx"));
const KidsHistory = lazy(() => import("./pages/Kids/KidsHistory.jsx"));
const KidsAdmin = lazy(() => import("./pages/Kids/KidsAdmin.jsx"));
const LifeAdminLayout = lazy(() => import("./pages/LifeAdmin/LifeAdminLayout.jsx"));
const LifeAdminRecords = lazy(() => import("./pages/LifeAdmin/Records.jsx"));
const LifeAdminBuilder = lazy(() => import("./pages/LifeAdmin/Builder.jsx"));
const LifeAdminLibrary = lazy(() => import("./pages/LifeAdmin/Library.jsx"));
const Tasks = lazy(() => import("./pages/Tasks/Tasks.jsx"));
const NotesLayout = lazy(() => import("./pages/Notes/NotesLayout.jsx"));
const Notes = lazy(() => import("./pages/Notes/Notes.jsx"));
const KidsProductPage = lazy(() => import("./pages/Marketing/KidsProductPage.jsx"));
const KidsPrivacyPage = lazy(() => import("./pages/Marketing/KidsPrivacyPage.jsx"));
const KidsSupportPage = lazy(() => import("./pages/Marketing/KidsSupportPage.jsx"));
const KidsTermsPage = lazy(() => import("./pages/Marketing/KidsTermsPage.jsx"));

const HealthHistoryRedirect = () => {
  const { date } = useParams();
  const target = date ? `/health/log?date=${encodeURIComponent(date)}` : "/health/log";
  return <Navigate to={target} replace />;
};

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading">Loading...</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/kids-app" element={<KidsProductPage />} />
        <Route path="/kids-app/privacy" element={<KidsPrivacyPage />} />
        <Route path="/kids-app/terms" element={<KidsTermsPage />} />
        <Route path="/kids-app/support" element={<KidsSupportPage />} />
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
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/notes" element={<NotesLayout />}>
          <Route index element={<Navigate to="/notes/personal" replace />} />
          <Route path="personal" element={<Notes />} />
          <Route path="family" element={<Notes />} />
          <Route path="shared" element={<Notes />} />
        </Route>
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/life-admin" element={<LifeAdminLayout />}>
          <Route index element={<Navigate to="/life-admin/records" replace />} />
          <Route path="records" element={<LifeAdminRecords />} />
          <Route path="library" element={<LifeAdminLibrary />} />
          <Route path="builder" element={<LifeAdminBuilder />} />
        </Route>
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/:section" element={<Settings />} />
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
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
      </Suspense>
  </BrowserRouter>
  </ErrorBoundary>
);

export default App;
