import { Routes, Route } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import DashboardHome from "./DashboardHome";
import OrdersList from "./OrdersList";
import TicketList from "./TicketList";
import Reports from "./Reports";
import GuestListManager from "./GuestListManager";
import VIPTableManager from "./VIPTableManager";
import { TraceDashboard } from "@/components/admin/TraceDashboard";
import { TraceList } from "@/components/admin/TraceList";
import { ErrorDashboard } from "@/components/admin/ErrorDashboard";

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="orders" element={<OrdersList />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="guest-lists" element={<GuestListManager />} />
            <Route path="vip-tables" element={<VIPTableManager />} />
            <Route path="reports" element={<Reports />} />
            <Route path="traces" element={<TraceDashboard />} />
            <Route path="traces/list" element={<TraceList />} />
            <Route path="errors" element={<ErrorDashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;


