import { Routes, Route } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import DashboardHome from "./DashboardHome";
import OrdersList from "./OrdersList";
import TicketList from "./TicketList";
import Reports from "./Reports";
import GuestListManager from "./GuestListManager";
import VIPTableManager from "./VIPTableManager";

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
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;


