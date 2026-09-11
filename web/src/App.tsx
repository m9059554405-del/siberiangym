import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Briefcase, ShieldCheck, Users } from 'lucide-react'
import { useAuthStore, type Role } from './store/useAuthStore'
import { RootLayout } from './layouts/RootLayout'
import { ClientShell } from './layouts/ClientShell'
import { SimpleShell } from './layouts/SimpleShell'
import { LoginPage } from './pages/LoginPage'
import { ComingSoonPage } from './pages/ComingSoonPage'

import { PaymentsPage } from './features/client/PaymentsPage'
import { CalendarPage } from './features/client/CalendarPage'
import { ShopPage } from './features/client/ShopPage'
import { TrainerSelectionPage } from './features/client/TrainerSelectionPage'

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
            <Route path="exercises" element={<ComingSoonPage title="Упражнения и программа" />} />
            <Route path="trainer" element={<TrainerSelectionPage />} />
            <Route path="news" element={<ComingSoonPage title="Новости клуба" />} />
            <Route path="progress" element={<ComingSoonPage title="Прогресс" />} />
          </Route>

          <Route
            path="/trainer"
            element={
              <RequireRole role="TRAINER">
                <SimpleShell tabs={[{ to: '/trainer', label: 'Клиенты', icon: Users }]} />
              </RequireRole>
            }
          >
            <Route index element={<ComingSoonPage title="Кабинет тренера" />} />
          </Route>

          <Route
            path="/staff"
            element={
              <RequireRole role="STAFF">
                <SimpleShell tabs={[{ to: '/staff', label: 'Клиенты', icon: Briefcase }]} />
              </RequireRole>
            }
          >
            <Route index element={<ComingSoonPage title="Кабинет администратора" />} />
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
