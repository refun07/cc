import axios from "axios";
import { getStoredToken, useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";

const api = axios.create({
  baseURL: "/api",
  headers: { Accept: "application/json" },
});

// Attach the customer's bearer token when signed in.
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gracefully handle an expired/invalid session instead of a raw browser alert.
let sessionToastShown = false;
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && getStoredToken()) {
      useAuthStore.getState().logout();
      if (!sessionToastShown) {
        sessionToastShown = true;
        toast.info("Your session expired. Please sign in again.", { title: "Signed out" });
        setTimeout(() => { sessionToastShown = false; }, 2000);
      }
    }
    return Promise.reject(err);
  }
);

export const registerAccount = (payload) =>
  api.post("/auth/register", payload).then((r) => r.data);

export const loginAccount = (payload) =>
  api.post("/auth/login", payload).then((r) => r.data);

export const fetchMyBookings = () =>
  api.get("/customer/bookings").then((r) => r.data.data);

export const updateMyProfile = (payload) =>
  api.patch("/auth/profile", payload).then((r) => r.data.user);

export const changeMyPassword = (payload) =>
  api.post("/auth/change-password", payload).then((r) => r.data);

// ---- Notifications (any signed-in role) ----
export const getNotifications = () => api.get("/notifications").then((r) => r.data);
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () => api.post("/notifications/read-all").then((r) => r.data);

// ---- Owner (community centre panel) ----
export const ownerDashboard = () => api.get("/owner/dashboard").then((r) => r.data);
export const ownerBookings = (params) => api.get("/owner/bookings", { params }).then((r) => r.data.data);
export const ownerBookingAction = (bookingNo, action, reason) =>
  api.patch(`/owner/bookings/${bookingNo}/status`, { action, reason }).then((r) => r.data.data);
export const ownerCreateBooking = (payload) => api.post("/owner/bookings", payload).then((r) => r.data.data);
export const ownerUpdateBooking = (bookingNo, payload) => api.patch(`/owner/bookings/${bookingNo}`, payload).then((r) => r.data.data);
export const ownerUpdateBookingAttachments = (bookingNo, payload) => api.patch(`/owner/bookings/${bookingNo}/attachments`, payload).then((r) => r.data.data);
export const ownerRefundBooking = (bookingNo, payload) => api.post(`/owner/bookings/${bookingNo}/refund`, payload).then((r) => r.data.data);
export const ownerCentreMenus = () => api.get("/owner/menus").then((r) => r.data.data);
export const ownerMenus = () => api.get("/owner/menus").then((r) => r.data.data);
export const ownerCreateMenu = (payload) => api.post("/owner/menus", payload).then((r) => r.data.data);
export const ownerUpdateMenu = (id, payload) => api.patch(`/owner/menus/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteMenu = (id) => api.delete(`/owner/menus/${id}`).then((r) => r.data);
export const ownerAvailability = (params) => api.get("/owner/availability", { params }).then((r) => r.data.data);
export const ownerToggleBlock = (payload) => api.post("/owner/availability/toggle", payload).then((r) => r.data);
export const ownerAddFacility = (payload) => api.post("/owner/facilities", payload).then((r) => r.data.data);
export const ownerUpdateFacility = (id, payload) => api.patch(`/owner/facilities/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteFacility = (id) => api.delete(`/owner/facilities/${id}`).then((r) => r.data);
export const ownerFloors = () => api.get("/owner/floors").then((r) => r.data.data);
export const ownerCreateFloor = (payload) => api.post("/owner/floors", payload).then((r) => r.data.data);
export const ownerUpdateFloor = (id, payload) => api.patch(`/owner/floors/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteFloor = (id) => api.delete(`/owner/floors/${id}`).then((r) => r.data);
export const ownerProfile = () => api.get("/owner/profile").then((r) => r.data.data);
export const ownerUpdateProfile = (payload) => api.patch("/owner/profile", payload).then((r) => r.data);
const filePost = (url, file) => {
  const fd = new FormData(); fd.append("file", file);
  return api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const ownerUploadCover = (file) => filePost("/owner/profile/cover", file);
export const ownerAddGallery = (file) => filePost("/owner/profile/gallery", file);
export const ownerDeleteGallery = (id) => api.delete(`/owner/profile/gallery/${id}`).then((r) => r.data);
export const ownerBookingNote = (bookingNo, notes) => api.patch(`/owner/bookings/${bookingNo}/note`, { notes }).then((r) => r.data);
export const adminBookingNote = (bookingNo, notes) => api.patch(`/admin/bookings/${bookingNo}/note`, { notes }).then((r) => r.data);

// generic owner resource helpers (inventory | employees | expenses | waste)
export const ownerList = (res) => api.get(`/owner/${res}`).then((r) => r.data.data);
export const ownerCreate = (res, payload) => api.post(`/owner/${res}`, payload).then((r) => r.data.data);
export const ownerUpdate = (res, id, payload) => api.patch(`/owner/${res}/${id}`, payload).then((r) => r.data.data);
export const ownerRemove = (res, id) => api.delete(`/owner/${res}/${id}`).then((r) => r.data);
export const ownerWastePartners = () => api.get("/owner/waste-partners").then((r) => r.data.data);
export const ownerAssignWaste = (id, payload) => api.post(`/owner/waste/${id}/assign`, payload).then((r) => r.data);
export const ownerAdjustStock = (id, payload) => api.post(`/owner/inventory/${id}/adjust`, payload).then((r) => r.data);
export const ownerStockMovements = (id) => api.get(`/owner/inventory/${id}/movements`).then((r) => r.data.data);
export const ownerInventorySystem = () => api.get("/owner/inventory-system").then((r) => r.data);
export const ownerInventoryTaxonomy = () => api.get("/owner/inventory-taxonomy").then((r) => r.data);
export const ownerAddTaxonomy = (type, name) => api.post("/owner/inventory-taxonomy", { type, name }).then((r) => r.data.data);
export const ownerRenameTaxonomy = (type, name, new_name) => api.patch("/owner/inventory-taxonomy", { type, name, new_name }).then((r) => r.data.data);
export const ownerDeleteTaxonomy = (type, name) => api.delete("/owner/inventory-taxonomy", { data: { type, name } }).then((r) => r.data.data);
export const ownerCreateSupplier = (payload) => api.post("/owner/inventory-system/suppliers", payload).then((r) => r.data.data);
export const ownerUpdateSupplier = (id, payload) => api.patch(`/owner/inventory-system/suppliers/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteSupplier = (id) => api.delete(`/owner/inventory-system/suppliers/${id}`).then((r) => r.data);
export const ownerCreatePurchaseOrder = (payload) => api.post("/owner/inventory-system/purchase-orders", payload).then((r) => r.data.data);
export const ownerScanPurchaseOrder = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/owner/inventory-system/scan-po", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data);
};
export const ownerScanProducts = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/owner/inventory-system/scan-products", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data);
};
export const ownerUpdatePurchaseOrder = (id, payload) => api.patch(`/owner/inventory-system/purchase-orders/${id}`, payload).then((r) => r.data.data);
export const ownerDeletePurchaseOrder = (id) => api.delete(`/owner/inventory-system/purchase-orders/${id}`).then((r) => r.data);
export const ownerUpdatePurchaseOrderStatus = (id, status) => api.patch(`/owner/inventory-system/purchase-orders/${id}/status`, { status }).then((r) => r.data.data);
export const ownerReceivePurchaseOrder = (id, payload) => api.post(`/owner/inventory-system/purchase-orders/${id}/receive`, payload).then((r) => r.data.data);
export const ownerReturnPurchaseOrder = (id, payload) => api.post(`/owner/inventory-system/purchase-orders/${id}/return`, payload).then((r) => r.data.data);
export const ownerDeletePurchaseReturn = (id) => api.delete(`/owner/inventory-system/purchase-returns/${id}`).then((r) => r.data);
export const ownerAddLot = (payload) => api.post("/owner/inventory-system/lots", payload).then((r) => r.data.data);
export const ownerUpdateLot = (id, payload) => api.patch(`/owner/inventory-system/lots/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteLot = (id) => api.delete(`/owner/inventory-system/lots/${id}`).then((r) => r.data);
export const ownerDeleteDamage = (id) => api.delete(`/owner/inventory-system/damages/${id}`).then((r) => r.data);
export const ownerDeleteStockCount = (id) => api.delete(`/owner/inventory-system/stock-counts/${id}`).then((r) => r.data);
export const ownerRecordDamage = (payload) => api.post("/owner/inventory-system/damages", payload).then((r) => r.data.data);
export const ownerUpdateDamageStatus = (id, status) => api.patch(`/owner/inventory-system/damages/${id}/status`, { status }).then((r) => r.data.data);
export const ownerCreateStockCount = (payload) => api.post("/owner/inventory-system/stock-counts", payload).then((r) => r.data.data);
export const ownerPostStockCount = (id, lines) => api.post(`/owner/inventory-system/stock-counts/${id}/post`, { lines }).then((r) => r.data.data);
export const ownerCancelStockCount = (id) => api.patch(`/owner/inventory-system/stock-counts/${id}/cancel`).then((r) => r.data.data);
export const ownerMarkAttendance = (id, status) => api.post(`/owner/employees/${id}/attendance`, { status }).then((r) => r.data.data);
export const ownerAttendanceReport = (date) => api.get("/owner/attendance/report", { params: date ? { date } : {} }).then((r) => r.data.data);
export const ownerSetEmployeeLogin = (id, password) => api.post(`/owner/employees/${id}/login`, { password }).then((r) => r.data);
export const ownerImpersonateStaff = (id) => api.post(`/owner/employees/${id}/impersonate`).then((r) => r.data);
export const ownerScanNid = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/owner/employees/scan-nid", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data);
};
export const ownerHrSettings = () => api.get("/owner/hr-settings").then((r) => r.data);
export const ownerUpdateHrSettings = (payload) => api.patch("/owner/hr-settings", payload).then((r) => r.data);
export const ownerReports = () => api.get("/owner/reports").then((r) => r.data);

// staff portal
export const staffMe = () => api.get("/staff/me").then((r) => r.data);
export const staffAttendance = () => api.get("/staff/attendance").then((r) => r.data.data);
export const staffPayslips = () => api.get("/staff/payslips").then((r) => r.data.data);
export const staffCheckIn = () => api.post("/staff/check-in").then((r) => r.data);

// payroll / accounting / uploads
export const ownerPayroll = (month) => api.get("/owner/payroll", { params: { month } }).then((r) => r.data);
export const ownerGeneratePayroll = (month) => api.post("/owner/payroll/generate", { month }).then((r) => r.data);
export const ownerUpdatePayroll = (id, payload) => api.patch(`/owner/payroll/${id}`, payload).then((r) => r.data.data);
export const ownerPayPayroll = (id, payment_method) => api.post(`/owner/payroll/${id}/pay`, { payment_method }).then((r) => r.data);
export const ownerDisburseAll = (month, payment_method) => api.post("/owner/payroll/disburse-all", { month, payment_method }).then((r) => r.data);
export const ownerAccounting = () => api.get("/owner/accounting").then((r) => r.data);
export const ownerAddLedgerEntry = (payload) => api.post("/owner/ledger", payload).then((r) => r.data.data);
export const ownerAddLedgerEntries = (entries) => api.post("/owner/ledger/bulk", { entries }).then((r) => r.data);
export const ownerDeleteLedgerEntry = (id) => api.delete(`/owner/ledger/${id}`).then((r) => r.data);
export const ownerScanLedger = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/owner/ledger/scan", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data);
};
export const ownerCrm = (params = {}) => api.get("/owner/crm", { params }).then((r) => r.data);
export const ownerCrmContact = (id) => api.get(`/owner/crm/${id}`).then((r) => r.data);
export const ownerCreateCrmContact = (payload) => api.post("/owner/crm", payload).then((r) => r.data.data);
export const ownerUpdateCrmContact = (id, payload) => api.patch(`/owner/crm/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteCrmContact = (id) => api.delete(`/owner/crm/${id}`).then((r) => r.data);
export const ownerCreateCrmActivity = (id, payload) => api.post(`/owner/crm/${id}/activities`, payload).then((r) => r.data);
export const ownerUpload = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/owner/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// ---- Admin ----
export const adminDashboard = () => api.get("/admin/dashboard").then((r) => r.data);
export const adminCentres = (params) => api.get("/admin/centres", { params }).then((r) => r.data.data);
export const adminSetCentreStatus = (id, status) =>
  api.patch(`/admin/centres/${id}/status`, { status }).then((r) => r.data);
export const adminSetCommissionRate = (id, commission_rate) =>
  api.patch(`/admin/centres/${id}/commission`, { commission_rate }).then((r) => r.data);
export const adminUsers = (params) => api.get("/admin/users", { params }).then((r) => r.data.data);
export const adminSetUserStatus = (id, status) => api.patch(`/admin/users/${id}/status`, { status }).then((r) => r.data);
export const adminImpersonate = (id) => api.post(`/admin/users/${id}/impersonate`).then((r) => r.data);
export const adminCreateBooking = (payload) => api.post("/admin/bookings", payload).then((r) => r.data.data);
export const adminReports = () => api.get("/admin/reports").then((r) => r.data);
export const adminExport = async (type) => {
  const res = await api.get(`/admin/export/${type}`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dscc-${type}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
export const adminBookings = (params) => api.get("/admin/bookings", { params }).then((r) => r.data.data);
export const adminPayments = () => api.get("/admin/payments").then((r) => r.data.data);

export const getHomepage = () => api.get("/homepage").then((r) => r.data.data);
export const adminHomepage = () => api.get("/admin/homepage").then((r) => r.data.data);
export const adminUpdateHomepage = (payload) => api.patch("/admin/homepage", payload).then((r) => r.data.data);
export const adminResetHomepage = () => api.post("/admin/homepage/reset").then((r) => r.data.data);
export const adminSettings = () => api.get("/admin/settings").then((r) => r.data.data);
export const adminUpdateSettings = (payload) => api.patch("/admin/settings", payload).then((r) => r.data.data);
export const adminSettlements = (params = {}) => api.get("/admin/settlements", { params }).then((r) => r.data);
export const adminCreateSettlement = (payload) => api.post("/admin/settlements", payload).then((r) => r.data.data);
export const adminUpdateSettlement = (id, payload) => api.patch(`/admin/settlements/${id}`, payload).then((r) => r.data.data);

// ---- Zero Waste Partner ----
export const partnerDashboard = () => api.get("/partner/dashboard").then((r) => r.data);
export const partnerPickups = (scope = "active") =>
  api.get("/partner/pickups", { params: { scope } }).then((r) => r.data.data);
export const partnerClaimPickup = (id, payload) =>
  api.post(`/partner/pickups/${id}/claim`, payload).then((r) => r.data.data);
export const partnerUpdatePickup = (id, payload) =>
  api.patch(`/partner/pickups/${id}/status`, payload).then((r) => r.data.data);
export const partnerUploadProof = (file) => {
  const fd = new FormData(); fd.append("file", file);
  return api.post("/partner/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

export const getCentres = (params) =>
  api.get("/centres", { params }).then((r) => r.data.data);

export const getCentre = (slug) =>
  api.get(`/centres/${slug}`).then((r) => r.data.data);

export const getAvailability = (slug, params) =>
  api.get(`/centres/${slug}/availability`, { params }).then((r) => r.data.data);

export const quoteBooking = (payload) =>
  api.post("/bookings/quote", payload).then((r) => r.data.data);

export const createBooking = (payload) =>
  api.post("/bookings", payload).then((r) => r.data.data);

export const getBooking = (bookingNo) =>
  api.get(`/bookings/${bookingNo}`).then((r) => r.data.data);

export const initiatePayment = (payload) =>
  api.post("/payments/initiate", payload).then((r) => r.data.data);

export const cancelBooking = (bookingNo, payload) =>
  api.post(`/bookings/${bookingNo}/cancel`, payload).then((r) => r.data.data);

export const updateBookingDetails = (bookingNo, payload) =>
  api.patch(`/bookings/${bookingNo}/details`, payload).then((r) => r.data.data);

export default api;
