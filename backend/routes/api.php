<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\OwnerController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\PublicCentreController;
use App\Http\Controllers\Api\WastePartnerController;
use App\Http\Controllers\Api\CrmController;
use App\Http\Controllers\Api\InventoryController;
use Illuminate\Support\Facades\Route;

// ---- Auth (phone-based customer accounts) ----
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::middleware('auth.token')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::get('/customer/bookings', [BookingController::class, 'myBookings']);

    // In-app notifications (any signed-in role)
    Route::get('/notifications', [\App\Http\Controllers\Api\NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [\App\Http\Controllers\Api\NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [\App\Http\Controllers\Api\NotificationController::class, 'markAllRead']);
});

// ---- Public APIs (Customer MVP slice) ----
Route::get('/homepage', fn () => response()->json(['data' => \App\Support\HomepageContent::get()]));
Route::get('/centres', [PublicCentreController::class, 'index']);
Route::get('/centres/{centre}', [PublicCentreController::class, 'show']);
Route::get('/centres/{centre}/availability', [PublicCentreController::class, 'availability']);
Route::get('/centres/{centre}/calendar', [PublicCentreController::class, 'calendar']);
Route::get('/centres/{centre}/food-menus', [PublicCentreController::class, 'foodMenus']);

Route::post('/bookings/quote', [BookingController::class, 'quote']);
Route::get('/bookings/{bookingNo}', [BookingController::class, 'show']);

// Booking creation & cancellation require a signed-in customer account.
Route::middleware('auth.token')->group(function () {
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::post('/bookings/{bookingNo}/cancel', [BookingController::class, 'cancel']);
    Route::patch('/bookings/{bookingNo}/details', [BookingController::class, 'updateDetails']);
});

Route::post('/payments/initiate', [PaymentController::class, 'initiate']);

// ---- Owner / Community Centre panel (token + owner role) ----
Route::middleware(['auth.token', 'role:owner'])->prefix('owner')->group(function () {
    Route::get('/dashboard', [OwnerController::class, 'dashboard']);
    Route::get('/bookings', [OwnerController::class, 'bookings']);
    Route::post('/bookings', [OwnerController::class, 'storeBooking']);
    Route::patch('/bookings/{bookingNo}', [OwnerController::class, 'updateBooking']);
    Route::patch('/bookings/{bookingNo}/attachments', [OwnerController::class, 'updateBookingAttachments']);
    Route::post('/bookings/{bookingNo}/refund', [OwnerController::class, 'refundBooking']);
    Route::patch('/bookings/{bookingNo}/status', [OwnerController::class, 'updateBookingStatus']);
    Route::get('/menus', [OwnerController::class, 'menus']);
    Route::post('/menus', [OwnerController::class, 'storeMenu']);
    Route::patch('/menus/{menu}', [OwnerController::class, 'updateMenu']);
    Route::delete('/menus/{menu}', [OwnerController::class, 'deleteMenu']);
    Route::get('/availability', [OwnerController::class, 'availability']);
    Route::post('/availability/toggle', [OwnerController::class, 'toggleBlock']);
    Route::post('/facilities', [OwnerController::class, 'storeFacility']);
    Route::patch('/facilities/{facility}', [OwnerController::class, 'updateFacility']);
    Route::delete('/facilities/{facility}', [OwnerController::class, 'deleteFacility']);
    Route::get('/floors', [OwnerController::class, 'floors']);
    Route::post('/floors', [OwnerController::class, 'storeFloor']);
    Route::patch('/floors/{floor}', [OwnerController::class, 'updateFloor']);
    Route::delete('/floors/{floor}', [OwnerController::class, 'deleteFloor']);
    Route::get('/profile', [OwnerController::class, 'profile']);
    Route::patch('/profile', [OwnerController::class, 'updateProfile']);
    Route::post('/profile/cover', [OwnerController::class, 'uploadCover']);
    Route::post('/profile/gallery', [OwnerController::class, 'addGalleryImage']);
    Route::delete('/profile/gallery/{image}', [OwnerController::class, 'deleteGalleryImage']);
    Route::patch('/bookings/{bookingNo}/note', [OwnerController::class, 'updateBookingNote']);

    // Inventory
    Route::get('/inventory', [OwnerController::class, 'inventory']);
    Route::post('/inventory', [OwnerController::class, 'storeInventory']);
    Route::patch('/inventory/{item}', [OwnerController::class, 'updateInventory']);
    Route::delete('/inventory/{item}', [OwnerController::class, 'deleteInventory']);
    Route::post('/inventory/{item}/adjust', [OwnerController::class, 'adjustStock']);
    Route::get('/inventory/{item}/movements', [OwnerController::class, 'stockMovements']);
    Route::get('/inventory-taxonomy', [OwnerController::class, 'inventoryTaxonomy']);
    Route::post('/inventory-taxonomy', [OwnerController::class, 'storeInventoryTaxonomy']);
    Route::patch('/inventory-taxonomy', [OwnerController::class, 'updateInventoryTaxonomy']);
    Route::delete('/inventory-taxonomy', [OwnerController::class, 'deleteInventoryTaxonomy']);
    Route::get('/inventory-system', [InventoryController::class, 'overview']);
    Route::post('/inventory-system/suppliers', [InventoryController::class, 'storeSupplier']);
    Route::patch('/inventory-system/suppliers/{supplier}', [InventoryController::class, 'updateSupplier']);
    Route::delete('/inventory-system/suppliers/{supplier}', [InventoryController::class, 'deleteSupplier']);
    Route::post('/inventory-system/purchase-orders', [InventoryController::class, 'storePurchaseOrder']);
    Route::patch('/inventory-system/purchase-orders/{purchaseOrder}', [InventoryController::class, 'updatePurchaseOrder']);
    Route::delete('/inventory-system/purchase-orders/{purchaseOrder}', [InventoryController::class, 'deletePurchaseOrder']);
    Route::patch('/inventory-system/purchase-orders/{purchaseOrder}/status', [InventoryController::class, 'updatePurchaseOrderStatus']);
    Route::post('/inventory-system/purchase-orders/{purchaseOrder}/receive', [InventoryController::class, 'receivePurchaseOrder']);
    Route::post('/inventory-system/purchase-orders/{purchaseOrder}/return', [InventoryController::class, 'returnPurchaseOrder']);
    Route::delete('/inventory-system/purchase-returns/{purchaseReturn}', [InventoryController::class, 'deletePurchaseReturn']);
    Route::post('/inventory-system/lots', [InventoryController::class, 'storeLot']);
    Route::patch('/inventory-system/lots/{lot}', [InventoryController::class, 'updateLot']);
    Route::delete('/inventory-system/lots/{lot}', [InventoryController::class, 'deleteLot']);
    Route::post('/inventory-system/damages', [InventoryController::class, 'storeDamage']);
    Route::patch('/inventory-system/damages/{damage}/status', [InventoryController::class, 'updateDamageStatus']);
    Route::delete('/inventory-system/damages/{damage}', [InventoryController::class, 'deleteDamage']);
    Route::post('/inventory-system/stock-counts', [InventoryController::class, 'storeStockCount']);
    Route::post('/inventory-system/stock-counts/{stockCount}/post', [InventoryController::class, 'postStockCount']);
    Route::patch('/inventory-system/stock-counts/{stockCount}/cancel', [InventoryController::class, 'cancelStockCount']);
    Route::delete('/inventory-system/stock-counts/{stockCount}', [InventoryController::class, 'deleteStockCount']);

    // HRM
    Route::get('/employees', [OwnerController::class, 'employees']);
    Route::post('/employees', [OwnerController::class, 'storeEmployee']);
    Route::patch('/employees/{employee}', [OwnerController::class, 'updateEmployee']);
    Route::delete('/employees/{employee}', [OwnerController::class, 'deleteEmployee']);
    Route::get('/attendance/report', [OwnerController::class, 'attendanceReport']);
    Route::post('/employees/{employee}/attendance', [OwnerController::class, 'markAttendance']);
    Route::post('/employees/{employee}/login', [OwnerController::class, 'setEmployeeLogin']);
    Route::post('/employees/{employee}/impersonate', [OwnerController::class, 'impersonateStaff']);
    Route::post('/employees/scan-nid', [OwnerController::class, 'scanNid']);
    Route::post('/inventory-system/scan-po', [OwnerController::class, 'scanPurchaseOrder']);
    Route::post('/inventory-system/scan-products', [OwnerController::class, 'scanProducts']);
    Route::get('/hr-settings', [OwnerController::class, 'hrSettings']);
    Route::patch('/hr-settings', [OwnerController::class, 'updateHrSettings']);

    // Expenses
    Route::get('/expenses', [OwnerController::class, 'expenses']);
    Route::post('/expenses', [OwnerController::class, 'storeExpense']);
    Route::patch('/expenses/{expense}', [OwnerController::class, 'updateExpense']);
    Route::delete('/expenses/{expense}', [OwnerController::class, 'deleteExpense']);

    // Zero waste
    Route::get('/waste', [OwnerController::class, 'wasteStreams']);
    Route::post('/waste', [OwnerController::class, 'storeWaste']);
    Route::patch('/waste/{waste}', [OwnerController::class, 'updateWaste']);
    Route::delete('/waste/{waste}', [OwnerController::class, 'deleteWaste']);
    Route::get('/waste-partners', [OwnerController::class, 'wastePartners']);
    Route::post('/waste/{waste}/assign', [OwnerController::class, 'assignWaste']);

    // Reports
    Route::get('/reports', [OwnerController::class, 'reports']);

    // Uploads (bills/receipts)
    Route::post('/uploads', [OwnerController::class, 'upload']);

    // Payroll / salary disbursement
    Route::get('/payroll', [OwnerController::class, 'payroll']);
    Route::post('/payroll/generate', [OwnerController::class, 'generatePayroll']);
    Route::patch('/payroll/{payroll}', [OwnerController::class, 'updatePayroll']);
    Route::post('/payroll/{payroll}/pay', [OwnerController::class, 'payPayroll']);
    Route::post('/payroll/disburse-all', [OwnerController::class, 'disburseAll']);

    // Accounting
    Route::get('/accounting', [OwnerController::class, 'accounting']);
    Route::post('/ledger', [OwnerController::class, 'storeLedgerEntry']);
    Route::post('/ledger/bulk', [OwnerController::class, 'storeLedgerEntries']);
    Route::post('/ledger/scan', [OwnerController::class, 'scanLedger']);
    Route::delete('/ledger/{ledgerEntry}', [OwnerController::class, 'deleteLedgerEntry']);

    // CRM
    Route::get('/crm', [CrmController::class, 'index']);
    Route::post('/crm', [CrmController::class, 'store']);
    Route::get('/crm/{contact}', [CrmController::class, 'show']);
    Route::patch('/crm/{contact}', [CrmController::class, 'update']);
    Route::delete('/crm/{contact}', [CrmController::class, 'destroy']);
    Route::post('/crm/{contact}/activities', [CrmController::class, 'storeActivity']);
});

// ---- Staff portal (token + staff role) ----
Route::middleware(['auth.token', 'role:staff'])->prefix('staff')->group(function () {
    Route::get('/me', [StaffController::class, 'me']);
    Route::get('/attendance', [StaffController::class, 'attendance']);
    Route::post('/check-in', [StaffController::class, 'checkIn']);
    Route::get('/payslips', [StaffController::class, 'payslips']);
});

// ---- Admin panel (token + admin role) ----
Route::middleware(['auth.token', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/centres', [AdminController::class, 'centres']);
    Route::patch('/centres/{centre:id}/status', [AdminController::class, 'updateCentreStatus']);
    Route::patch('/centres/{centre:id}/commission', [AdminController::class, 'updateCommissionRate']);
    Route::get('/users', [AdminController::class, 'users']);
    Route::patch('/users/{user}/status', [AdminController::class, 'updateUserStatus']);
    Route::post('/users/{user}/impersonate', [AdminController::class, 'impersonate']);
    Route::get('/bookings', [AdminController::class, 'bookings']);
    Route::post('/bookings', [AdminController::class, 'storeBooking']);
    Route::patch('/bookings/{bookingNo}/note', [AdminController::class, 'updateBookingNote']);
    Route::get('/payments', [AdminController::class, 'payments']);
    Route::get('/settings', [AdminController::class, 'settings']);
    Route::patch('/settings', [AdminController::class, 'updateSettings']);
    Route::get('/homepage', [AdminController::class, 'homepage']);
    Route::patch('/homepage', [AdminController::class, 'updateHomepage']);
    Route::post('/homepage/reset', [AdminController::class, 'resetHomepage']);
    Route::get('/settlements', [AdminController::class, 'settlements']);
    Route::post('/settlements', [AdminController::class, 'storeSettlement']);
    Route::patch('/settlements/{settlement}', [AdminController::class, 'updateSettlement']);
    Route::get('/reports', [AdminController::class, 'reports']);
    Route::get('/export/bookings', [AdminController::class, 'exportBookings']);
    Route::get('/export/payments', [AdminController::class, 'exportPayments']);
});

// ---- Zero Waste Partner portal ----
Route::middleware(['auth.token', 'role:waste_partner'])->prefix('partner')->group(function () {
    Route::get('/dashboard', [WastePartnerController::class, 'dashboard']);
    Route::get('/pickups', [WastePartnerController::class, 'pickups']);
    Route::post('/pickups/{waste}/claim', [WastePartnerController::class, 'claim']);
    Route::patch('/pickups/{waste}/status', [WastePartnerController::class, 'updateStatus']);
    Route::post('/uploads', [WastePartnerController::class, 'upload']);
});
