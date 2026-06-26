import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { BudgetProvider } from "../providers/BudgetProvider";
import { DashboardProvider } from "../providers/DashboardProvider";
import { OverviewPage } from "../../pages/overview/OverviewPage";
import { InsightsPage } from "../../pages/insights/InsightsPage";
import { ImportManagerPage } from "../../features/import/ImportManagerPage";
import { DesignsPage } from "../../pages/designs/DesignsPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <BudgetProvider>
        <DashboardProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/imports" element={<ImportManagerPage />} />
              <Route path="/designs" element={<DesignsPage />} />
            </Route>
          </Routes>
        </DashboardProvider>
      </BudgetProvider>
    </BrowserRouter>
  );
}
