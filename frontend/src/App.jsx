import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import Home from "./pages/Home/Home.jsx";
import BudgetLayout from "./pages/Budget/BudgetLayout.jsx";
import BudgetIncome from "./pages/Budget/Income.jsx";
import BudgetExpenses from "./pages/Budget/Expenses.jsx";
import BudgetAllocations from "./pages/Budget/Allocations.jsx";
import BudgetSettings from "./pages/Budget/Settings.jsx";
import Login from "./pages/Login/Login.jsx";
import ResetPassword from "./pages/Login/ResetPassword.jsx";
import Settings from "./pages/Settings/Settings.jsx";
import HealthLayout from "./pages/Health/HealthLayout.jsx";
import HealthToday from "./pages/Health/Today.jsx";
import HealthLog from "./pages/Health/Log.jsx";
import HealthFoods from "./pages/Health/Foods.jsx";
import HealthHistory from "./pages/Health/History.jsx";
import HealthHistoryDay from "./pages/Health/HistoryDay.jsx";
import HealthInsights from "./pages/Health/Insights.jsx";
import HealthSettings from "./pages/Health/Settings.jsx";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
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
          <Route path="history" element={<HealthHistory />} />
          <Route path="history/:date" element={<HealthHistoryDay />} />
          <Route path="insights" element={<HealthInsights />} />
          <Route path="settings" element={<HealthSettings />} />
        </Route>
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
