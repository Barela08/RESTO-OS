import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Customer Views & Layout
import { CustomerLayout } from '../../components/layout/CustomerLayout';
import { CustomerSessionGuard } from '../guards/CustomerSessionGuard';
import { CustomerHomePage } from '../../modules/customer/CustomerHomePage';
import { MenuPage } from '../../modules/customer/MenuPage';
import { CustomerBagPage } from '../../modules/customer/CustomerBagPage';
import { CustomerOrdersPage } from '../../modules/customer/CustomerOrdersPage';
import { CustomerProfilePage } from '../../modules/customer/CustomerProfilePage';
import { OrderTrackingPage } from '../../modules/customer/OrderTrackingPage';
import { CustomerPaymentPage } from '../../modules/customer/CustomerPaymentPage';
import { CustomerLoyaltyPage } from '../../modules/customer/CustomerLoyaltyPage';

// Auth Views
import { AdminLoginPage } from '../../modules/auth/AdminLoginPage';
import { StaffLoginPage } from '../../modules/auth/StaffLoginPage';

// Guards
import { RoleBasedGuard } from '../guards/RoleBasedGuard';

// Staff Terminals
import { KitchenDashboard } from '../../modules/kitchen/KitchenDashboard';
import { WaiterDashboard } from '../../modules/waiter/WaiterDashboard';
import { CashCounterDashboard } from '../../modules/counter/CashCounterDashboard';

// Admin Views
import { AdminDashboard } from '../../modules/admin/AdminDashboard';
import { AdminTables } from '../../modules/admin/AdminTables';
import { AdminDailyQR } from '../../modules/admin/AdminDailyQR';
import { AdminMenu } from '../../modules/admin/AdminMenu';
import { AdminStaff } from '../../modules/admin/AdminStaff';
import { AdminInventory } from '../../modules/admin/AdminInventory';
import { AdminPayments } from '../../modules/admin/AdminPayments';
import { AdminLoyalty } from '../../modules/admin/AdminLoyalty';
import { AdminSettings } from '../../modules/admin/AdminSettings';

// Owner Views
import { OwnerDashboard } from '../../modules/owner/OwnerDashboard';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ============================================================== */}
        {/* CUSTOMER ROUTES (RESPONSIVE DESKTOP & APP-LIKE MOBILE)         */}
        {/* ============================================================== */}
        <Route
          path="/"
          element={
            <CustomerLayout>
              <CustomerHomePage />
            </CustomerLayout>
          }
        />
        <Route
          path="/home"
          element={
            <CustomerLayout>
              <CustomerHomePage />
            </CustomerLayout>
          }
        />
        <Route
          path="/menu"
          element={
            <CustomerLayout>
              <MenuPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/order"
          element={
            <CustomerLayout>
              <MenuPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/bag"
          element={
            <CustomerLayout>
              <CustomerBagPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/cart"
          element={
            <CustomerLayout>
              <CustomerBagPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/orders"
          element={
            <CustomerLayout>
              <CustomerOrdersPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/my-orders"
          element={
            <CustomerLayout>
              <CustomerOrdersPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <CustomerLayout>
              <CustomerProfilePage />
            </CustomerLayout>
          }
        />
        <Route
          path="/account"
          element={
            <CustomerLayout>
              <CustomerProfilePage />
            </CustomerLayout>
          }
        />
        <Route
          path="/my-rewards"
          element={
            <CustomerLayout>
              <CustomerLoyaltyPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/order/track/:id"
          element={
            <CustomerLayout>
              <OrderTrackingPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/order/payment/:id"
          element={
            <CustomerLayout>
              <CustomerPaymentPage />
            </CustomerLayout>
          }
        />
        <Route
          path="/payment/:id"
          element={
            <CustomerLayout>
              <CustomerPaymentPage />
            </CustomerLayout>
          }
        />

        {/* ============================================================== */}
        {/* AUTHENTICATION ROUTES                                          */}
        {/* ============================================================== */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/staff/login" element={<StaffLoginPage />} />

        {/* ============================================================== */}
        {/* STAFF TERMINALS (ROLE PROTECTED)                               */}
        {/* ============================================================== */}
        <Route
          path="/kitchen"
          element={
            <RoleBasedGuard allowedRoles={['kitchen', 'admin', 'owner']}>
              <KitchenDashboard />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/waiter"
          element={
            <RoleBasedGuard allowedRoles={['waiter', 'admin', 'owner']}>
              <WaiterDashboard />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/counter"
          element={
            <RoleBasedGuard allowedRoles={['counter', 'admin', 'owner']}>
              <CashCounterDashboard />
            </RoleBasedGuard>
          }
        />

        {/* ============================================================== */}
        {/* ADMIN MANAGEMENT ROUTES (ADMIN & OWNER ACCESS)                 */}
        {/* ============================================================== */}
        <Route
          path="/admin"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminDashboard />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/tables"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminTables />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/qr"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminDailyQR />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/menu"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminMenu />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminStaff />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminInventory />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminPayments />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/loyalty"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminLoyalty />
            </RoleBasedGuard>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RoleBasedGuard allowedRoles={['admin', 'owner']}>
              <AdminSettings />
            </RoleBasedGuard>
          }
        />

        {/* ============================================================== */}
        {/* OWNER EXECUTIVE ANALYTICS                                      */}
        {/* ============================================================== */}
        <Route
          path="/owner"
          element={
            <RoleBasedGuard allowedRoles={['owner', 'admin']}>
              <OwnerDashboard />
            </RoleBasedGuard>
          }
        />

        {/* 404 Fallback */}
        <Route path="*" element={<Navigate to="/order" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
