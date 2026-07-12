import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GoogleCallbackPage from './pages/GoogleCallbackPage';
import ChatPage from './pages/ChatPage';
import MyTripsPage from './pages/MyTripsPage';
import AdminDashboard from './pages/AdminDashboard';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  const { setToken, logout, user } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);

  // On every app boot / page refresh, silently call /auth/refresh to restore
  // the in-memory accessToken from the httpOnly refresh cookie.
  // This prevents logout-on-refresh while keeping the token out of localStorage.
  useEffect(() => {
    const restoreSession = async () => {
      if (user) {
        // User profile exists in sessionStorage — try to get a fresh access token
        try {
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
            {},
            { withCredentials: true }
          );
          setToken(data.accessToken);
        } catch {
          // Refresh token expired or invalid — force logout cleanly
          logout();
        }
      }
      setAuthReady(true);
    };
    restoreSession();
  }, []);

  // Ensure the HTML class is always in sync with the persisted store value
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Hold rendering until the session restore attempt has completed
  // to prevent a flash-redirect to /login before token is restored
  if (!authReady) return null;

  const isDark = theme === 'dark';

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Skip navigation link for keyboard / screen-reader accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:text-sm focus:font-bold focus:shadow-lg"
        >
          Skip to main content
        </a>

        <div
          className={`min-h-screen flex flex-col selection:bg-primary/30 selection:text-white transition-colors duration-300 ${
            isDark ? 'bg-[#090d16] text-slate-100' : 'bg-slate-50 text-slate-900'
          }`}
        >
          <Toaster
            position="top-right"
            toastOptions={{
              style: isDark
                ? { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', fontSize: '13px' }
                : { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0', fontSize: '13px' },
              success: { iconTheme: { primary: '#6366f1', secondary: isDark ? '#fff' : '#fff' } },
              error: { iconTheme: { primary: '#f87171', secondary: '#fff' } },
            }}
          />
          <Navbar />
          <main id="main-content" className="flex-1" tabIndex={-1}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<GoogleCallbackPage />} />

              {/* Protected Traveler Routes */}
              <Route element={<ProtectedRoute allowedRoles={['traveler']} />}>
                <Route path="/dashboard" element={<MyTripsPage />} />
                <Route path="/dashboard/plan" element={<ChatPage />} />
              </Route>

              {/* Protected Admin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
