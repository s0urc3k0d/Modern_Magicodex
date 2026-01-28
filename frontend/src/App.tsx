import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Components
import Layout from './components/Layout';
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CollectionPage = lazy(() => import('./pages/CollectionPage'));
const DecksPage = lazy(() => import('./pages/DecksPage'));
const DeckBuilderPage = lazy(() => import('./pages/DeckBuilderPage'));
const DeckViewPage = lazy(() => import('./pages/DeckViewPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const MissingBySetPage = lazy(() => import('./pages/MissingBySetPage'));
const CollectionStatsPage = lazy(() => import('./pages/CollectionStatsPage'));
const ListsPage = lazy(() => import('./pages/ListsPage'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
import RequireAdmin from './components/RequireAdmin';

// Context
import { AuthProvider } from './contexts/AuthContext';

// DynamicQueryProvider removed to avoid invalid hook calls; use static provider.

function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 1 },
    },
  }));
  return (
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-mtg-background">
            <Suspense fallback={<div className="p-8 text-center text-gray-400">Chargement…</div>}>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Protected routes with layout */}
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="collection" element={<CollectionPage />} />
                <Route path="collection/missing" element={<MissingBySetPage />} />
                <Route path="collection/stats" element={<CollectionStatsPage />} />
                <Route path="lists" element={<ListsPage />} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="scan" element={<RequireAdmin><ScanPage /></RequireAdmin>} />
                <Route path="decks" element={<DecksPage />} />
                <Route path="decks/view/:id" element={<DeckViewPage />} />
                <Route path="decks/builder/:id?" element={<DeckBuilderPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>

              {/* 404 route */}
              <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            
            {/* Toast notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #374151',
                },
                success: {
                  iconTheme: {
                    primary: '#E49B0F',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#D3202A',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
        </Router>
        </QueryClientProvider>
      </AuthProvider>
  );
}

export default App;
