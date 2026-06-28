import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Toaster from "./components/Toaster";
import ConfirmDialog from "./components/ConfirmDialog";

const Layout = lazy(() => import("./components/Layout"));
const OwnerAccounting = lazy(() => import("./pages/owner/OwnerAccounting"));
const OwnerCRM = lazy(() => import("./pages/owner/OwnerCRM"));
const StaffPortal = lazy(() => import("./pages/staff/StaffPortal"));
const Home = lazy(() => import("./pages/Home"));
const CentreListing = lazy(() => import("./pages/CentreListing"));
const CentreDetail = lazy(() => import("./pages/CentreDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const BookingSuccess = lazy(() => import("./pages/BookingSuccess"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const OwnerLayout = lazy(() => import("./pages/owner/OwnerLayout"));
const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard"));
const OwnerBookings = lazy(() => import("./pages/owner/OwnerBookings"));
const OwnerAvailability = lazy(() => import("./pages/owner/OwnerAvailability"));
const OwnerMenus = lazy(() => import("./pages/owner/OwnerMenus"));
const OwnerProfile = lazy(() => import("./pages/owner/OwnerProfile"));
const OwnerInventory = lazy(() => import("./pages/owner/OwnerInventory"));
const OwnerHRM = lazy(() => import("./pages/owner/OwnerHRM"));
const OwnerExpenses = lazy(() => import("./pages/owner/OwnerExpenses"));
const OwnerZeroWaste = lazy(() => import("./pages/owner/OwnerZeroWaste"));
const OwnerReports = lazy(() => import("./pages/owner/OwnerReports"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCentres = lazy(() => import("./pages/admin/AdminCentres"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettlements = lazy(() => import("./pages/admin/AdminSettlements"));
const PartnerLayout = lazy(() => import("./pages/partner/PartnerLayout"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerPickups = lazy(() => import("./pages/partner/PartnerPickups"));
const PartnerImpact = lazy(() => import("./pages/partner/PartnerImpact"));

export default function App() {
  return (
    <>
    <Toaster />
    <ConfirmDialog />
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      {/* Customer site */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/centres" element={<CentreListing />} />
        <Route path="/centres/:slug" element={<CentreDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/booking/:bookingNo" element={<BookingSuccess />} />
        <Route path="/my-bookings" element={<MyBookings />} />
      </Route>

      {/* Owner / Community Centre panel */}
      <Route path="/owner" element={<OwnerLayout />}>
        <Route index element={<OwnerDashboard />} />
        <Route path="bookings" element={<OwnerBookings />} />
        <Route path="availability" element={<OwnerAvailability />} />
        <Route path="menus" element={<OwnerMenus />} />
        <Route path="inventory" element={<OwnerInventory />} />
        <Route path="hrm" element={<OwnerHRM />} />
        <Route path="expenses" element={<OwnerExpenses />} />
        <Route path="accounting" element={<OwnerAccounting />} />
        <Route path="crm" element={<OwnerCRM />} />
        <Route path="waste" element={<OwnerZeroWaste />} />
        <Route path="reports" element={<OwnerReports />} />
        <Route path="profile" element={<OwnerProfile />} />
      </Route>

      {/* Admin panel */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="centres" element={<AdminCentres />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="settlements" element={<AdminSettlements />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>

      {/* Staff portal */}
      <Route path="/staff" element={<StaffPortal />} />

      {/* Zero Waste Partner portal */}
      <Route path="/partner" element={<PartnerLayout />}>
        <Route index element={<PartnerDashboard />} />
        <Route path="pickups" element={<PartnerPickups />} />
        <Route path="impact" element={<PartnerImpact />} />
      </Route>
      </Routes>
    </Suspense>
    </>
  );
}

function RouteLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden="true" />
        Loading workspace…
      </div>
    </div>
  );
}
