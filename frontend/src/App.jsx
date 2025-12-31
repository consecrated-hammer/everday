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
          <Route index element={<Navigate to="/budget/income" replace />} />
          <Route path="income" element={<BudgetIncome />} />
          <Route path="expenses" element={<BudgetExpenses />} />
          <Route path="allocations" element={<BudgetAllocations />} />
          <Route path="settings" element={<BudgetSettings />} />
        </Route>
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
