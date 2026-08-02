import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  HomePage,
  VideoPage,
  AdminPage,
  CalendarPage,
  AlbumPage,
  UploadPage,
  MyAlbumPage,
  MyAlbumDetailPage,
  MyPage,
  DayAlbumPage,
  MediaViewerPage,
  SupportManagementPage,
} from './pages';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BottomNavigationLayout from './components/common/BottomNavigationLayout';

// 로그인 필요한 라우트 보호
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500">로딩 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">로딩 중...</p>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/mypage" replace />;
  return children;
};

function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <>
    <Routes location={backgroundLocation || location}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/calendar" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/video/:videoId"
        element={
          <ProtectedRoute>
            <VideoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support-management"
        element={
          <AdminRoute>
            <SupportManagementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/media/:mediaId"
        element={
          <ProtectedRoute>
            <MediaViewerPage />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <BottomNavigationLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/calendar/:date" element={<DayAlbumPage />} />
        <Route path="/album" element={<AlbumPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route
          path="/upload-list"
          element={(
            <AdminRoute>
              <UploadPage listOnly />
            </AdminRoute>
          )}
        />
        <Route path="/my-album" element={<MyAlbumPage />} />
        <Route path="/my-album/:albumId" element={<MyAlbumDetailPage />} />
        <Route path="/mypage" element={<MyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {backgroundLocation && (
      <Routes>
        <Route
          path="/upload"
          element={(
            <ProtectedRoute>
              <UploadOverlay targetDate={location.state?.uploadDate} />
            </ProtectedRoute>
          )}
        />
      </Routes>
    )}
    </>
  );
}

const UploadOverlay = ({ targetDate }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event) => {
      if (event.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="업로드">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => navigate(-1)} aria-label="업로드 닫기" />
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="z-20 flex shrink-0 items-center justify-between bg-surface p-6 pb-0">
          <h2 className="text-xl font-bold text-text-primary">업로드</h2>
          <button type="button" onClick={() => navigate(-1)} className="flex size-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary" aria-label="업로드 닫기">
            <Icon icon="mdi:close" className="text-2xl" />
          </button>
        </div>
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <UploadPage embedded initialDate={targetDate} targetDate={targetDate} />
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
