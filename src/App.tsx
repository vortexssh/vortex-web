import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { Require2FA } from '@/components/auth/Require2FA'
import { ToastViewport } from '@/components/ui/Toast'
import { LoginPage, RegisterPage, VerifyEmailPage } from '@/features/auth/AuthPages'
import { Setup2FAPage } from '@/features/auth/Setup2FAPage'
import { useAuthStore } from '@/store/authStore'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const HostsPage = lazy(() =>
  import('@/features/hosts/HostsPage').then((m) => ({ default: m.HostsPage })),
)
const TerminalPage = lazy(() =>
  import('@/features/terminal/TerminalPage').then((m) => ({ default: m.TerminalPage })),
)
const TasksPage = lazy(() =>
  import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const PublicStatusPage = lazy(() =>
  import('@/features/status/PublicStatusPage').then((m) => ({ default: m.PublicStatusPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function PageFallback() {
  return (
    <div className="font-mono text-xs text-muted">loading module…</div>
  )
}

function Bootstrap({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const bootstrapped = useAuthStore((s) => s.bootstrapped)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (!bootstrapped) {
    return (
      <div className="flex h-full items-center justify-center bg-void font-mono text-sm text-muted">
        bootstrapping session…
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Bootstrap>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/u/:slug"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PublicStatusPage />
                </Suspense>
              }
            />
            <Route
              element={
                <RequireAuth>
                  <Require2FA>
                    <AppLayout />
                  </Require2FA>
                </RequireAuth>
              }
            >
              <Route
                index
                element={
                  <Suspense fallback={<PageFallback />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route
                path="hosts"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <HostsPage />
                  </Suspense>
                }
              />
              <Route
                path="terminal"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <TerminalPage />
                  </Suspense>
                }
              />
              <Route
                path="terminal/:hostId"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <TerminalPage />
                  </Suspense>
                }
              />
              <Route
                path="tasks"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <TasksPage />
                  </Suspense>
                }
              />
              <Route path="security/2fa" element={<Setup2FAPage />} />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Bootstrap>
        <ToastViewport />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
