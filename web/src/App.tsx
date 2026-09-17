import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore, type Role } from './store/useAuthStore'
import { RootLayout } from './layouts/RootLayout'
import { ClientShell } from './layouts/ClientShell'
import { TrainerShell } from './layouts/TrainerShell'
import { StaffShell } from './layouts/StaffShell'
import { CeoShell } from './layouts/CeoShell'
import { LoginPage } from './pages/LoginPage'

import { PaymentsPage } from './features/client/PaymentsPage'
import { CalendarPage } from './features/client/CalendarPage'
import { ShopPage } from './features/client/ShopPage'
import { TrainerSelectionPage } from './features/client/TrainerSelectionPage'
import { ExercisesPage } from './features/client/ExercisesPage'
import { NewsPage } from './features/client/NewsPage'
import { ProgressPage } from './features/client/ProgressPage'
import { MyQrPage } from './features/client/MyQrPage'
import { NotificationsPage } from './features/client/NotificationsPage'

import { ClientListPage } from './features/trainer/ClientListPage'
import { ClientDetailPage } from './features/trainer/ClientDetailPage'
import { TrainerSchedulePage } from './features/trainer/TrainerSchedulePage'

import { ClientsManagePage } from './features/staff/ClientsManagePage'
import { LeadsPage } from './features/staff/LeadsPage'
import { NewsComposerPage } from './features/staff/NewsComposerPage'
import { CleaningPage } from './features/staff/CleaningPage'
import { EquipmentPage } from './features/staff/EquipmentPage'
import { StockPage } from './features/shared/StockPage'
import { OrdersPage } from './features/shared/OrdersPage'
import { CheckinsPage } from './features/shared/CheckinsPage'

import { TrainerLoadPage } from './features/ceo/TrainerLoadPage'
import { AttendancePage } from './features/ceo/AttendancePage'
import { RevenuePage } from './features/ceo/RevenuePage'
import { ClientBasePage } from './features/ceo/ClientBasePage'
import { TrainerDetailPage } from './features/ceo/TrainerDetailPage'
import { MaintenancePage } from './features/ceo/MaintenancePage'
import { ReportOffersPage } from './features/ceo/ReportOffersPage'
import { ActivityLogPage } from './features/ceo/ActivityLogPage'
import { GymsPage } from './features/ceo/GymsPage'

const ROLE_HOME: Record<Role, string> = {
  CLIENT: '/client/payments',
  TRAINER: '/trainer',
  STAFF: '/staff',
  CEO: '/ceo',
}

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <>{children}</>
}

function HomeRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RootLayout />}>
          <Route path="/" element={<HomeRedirect />} />

          <Route
            path="/client"
            element={
              <RequireRole role="CLIENT">
                <ClientShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/client/payments" replace />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="trainer" element={<TrainerSelectionPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="qr" element={<MyQrPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route
            path="/trainer"
            element={
              <RequireRole role="TRAINER">
                <TrainerShell />
              </RequireRole>
            }
          >
            <Route index element={<ClientListPage />} />
            <Route path="clients/:clientId" element={<ClientDetailPage />} />
            <Route path="schedule" element={<TrainerSchedulePage />} />
          </Route>

          <Route
            path="/staff"
            element={
              <RequireRole role="STAFF">
                <StaffShell />
              </RequireRole>
            }
          >
          <Route index element={<ClientsManagePage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="checkins" element={<CheckinsPage />} />
          <Route path="orders" element={<OrdersPage />} />
            <Route path="news" element={<NewsComposerPage />} />
            <Route path="cleaning" element={<CleaningPage />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="stock" element={<StockPage />} />
          </Route>

          <Route
            path="/ceo"
            element={
              <RequireRole role="CEO">
                <CeoShell />
              </RequireRole>
            }
          >
            <Route index element={<TrainerLoadPage />} />
            <Route path="trainers/:trainerId" element={<TrainerDetailPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="checkins" element={<CheckinsPage />} />
          <Route path="revenue" element={<RevenuePage />} />
            <Route path="clients" element={<ClientBasePage />} />
            <Route path="gyms" element={<GymsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="offers" element={<ReportOffersPage />} />
            <Route path="activity" element={<ActivityLogPage />} />
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
