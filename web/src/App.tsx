import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuthStore, type Role } from './store/useAuthStore'
import { RootLayout } from './layouts/RootLayout'
import { ClientShell } from './layouts/ClientShell'
import { TrainerShell } from './layouts/TrainerShell'
import { StaffShell } from './layouts/StaffShell'
import { SimpleShell } from './layouts/SimpleShell'
import { LoginPage } from './pages/LoginPage'
import { ComingSoonPage } from './pages/ComingSoonPage'

import { PaymentsPage } from './features/client/PaymentsPage'
import { CalendarPage } from './features/client/CalendarPage'
import { ShopPage } from './features/client/ShopPage'
import { TrainerSelectionPage } from './features/client/TrainerSelectionPage'
import { ExercisesPage } from './features/client/ExercisesPage'
import { NewsPage } from './features/client/NewsPage'
import { ProgressPage } from './features/client/ProgressPage'

import { ClientListPage } from './features/trainer/ClientListPage'
import { ClientDetailPage } from './features/trainer/ClientDetailPage'
import { TrainerSchedulePage } from './features/trainer/TrainerSchedulePage'

import { ClientsManagePage } from './features/staff/ClientsManagePage'
import { NewsComposerPage } from './features/staff/NewsComposerPage'
import { CleaningPage } from './features/staff/CleaningPage'
import { EquipmentPage } from './features/staff/EquipmentPage'
import { StockPage } from './features/shared/StockPage'

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
            <Route path="news" element={<NewsComposerPage />} />
            <Route path="cleaning" element={<CleaningPage />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="stock" element={<StockPage />} />
          </Route>

          <Route
            path="/ceo"
            element={
              <RequireRole role="CEO">
                <SimpleShell tabs={[{ to: '/ceo', label: 'Обзор', icon: ShieldCheck }]} />
              </RequireRole>
            }
          >
            <Route index element={<ComingSoonPage title="Кабинет CEO" />} />
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
