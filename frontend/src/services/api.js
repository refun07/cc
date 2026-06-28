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
export const ownerCentreMenus = () => api.get("/owner/menus").then((r) => r.data.data);
export const ownerMenus = () => api.get("/owner/menus").then((r) => r.data.data);
export const ownerCreateMenu = (payload) => api.post("/owner/menus", payload).then((r) => r.data.data);
export const ownerUpdateMenu = (id, payload) => api.patch(`/owner/menus/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteMenu = (id) => api.delete(`/owner/menus/${id}`).then((r) => r.data);
export const ownerAvailability = (params) => api.get("/owner/availability", { params }).then((r) => r.data.data);
export const ownerToggleBlock = (payload) => api.post("/owner/availability/toggle", payload).then((r) => r.data);
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
export const ownerCreateSupplier = (payload) => api.post("/owner/inventory-system/suppliers", payload).then((r) => r.data.data);
export const ownerUpdateSupplier = (id, payload) => api.patch(`/owner/inventory-system/suppliers/${id}`, payload).then((r) => r.data.data);
export const ownerDeleteSupplier = (id) => api.delete(`/owner/inventory-system/suppliers/${id}`).then((r) => r.data);
export const ownerCreatePurchaseOrder = (payload) => api.post("/owner/inventory-system/purchase-orders", payload).then((r) => r.data.data);
export const ownerUpdatePurchaseOrderStatus = (id, status) => api.patch(`/owner/inventory-system/purchase-orders/${id}/status`, { status }).then((r) => r.data.data);
export const ownerReceivePurchaseOrder = (id, payload) => api.post(`/owner/inventory-system/purchase-orders/${id}/receive`, payload).then((r) => r.data.data);
export const ownerReturnPurchaseOrder = (id, payload) => api.post(`/owner/inventory-system/purchase-orders/${id}/return`, payload).then((r) => r.data.data);
export const ownerRecordDamage = (payload) => api.post("/owner/inventory-system/damages", payload).then((r) => r.data.data);
export const ownerUpdateDamageStatus = (id, status) => api.patch(`/owner/inventory-system/damages/${id}/status`, { status }).then((r) => r.data.data);
export const ownerCreateStockCount = (payload) => api.post("/owner/inventory-system/stock-counts", payload).then((r) => r.data.data);
export const ownerPostStockCount = (id, lines) => api.post(`/owner/inventory-system/stock-counts/${id}/post`, { lines }).then((r) => r.data.data);
export const ownerCancelStockCount = (id) => api.patch(`/owner/inventory-system/stock-counts/${id}/cancel`).then((r) => r.data.data);
export const ownerMarkAttendance = (id, status) => api.post(`/owner/employees/${id}/attendance`, { status }).then((r) => r.data.data);
export const ownerSetEmployeeLogin = (id, password) => api.post(`/owner/employees/${id}/login`, { password }).then((r) => r.data);
export const ownerReports = () => api.get("/owner/reports").then((r) => r.data);

// staff portal
export const staffMe = () => api.get("/staff/me").then((r) => r.data);
export const staffAttendance = () => api.get("/staff/attendance").then((r) => r.data.data);
export const staffPayslips = () => api.get("/staff/payslips").then((r) => r.data.data);

// payroll / accounting / uploads
export const ownerPayroll = (month) => api.get("/owner/payroll", { params: { month } }).then((r) => r.data);
export const ownerGeneratePayroll = (month) => api.post("/owner/payroll/generate", { month }).then((r) => r.data);
export const ownerUpdatePayroll = (id, payload) => api.patch(`/owner/payroll/${id}`, payload).then((r) => r.data.data);
export const ownerPayPayroll = (id, payment_method) => api.post(`/owner/payroll/${id}/pay`, { payment_method }).then((r) => r.data);
export const ownerDisburseAll = (month, payment_method) => api.post("/owner/payroll/disburse-all", { month, payment_method }).then((r) => r.data);
export const ownerAccounting = () => api.get("/owner/accounting").then((r) => r.data);
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

export default api;
