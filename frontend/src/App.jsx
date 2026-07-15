import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
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
        <Route path="/my-album" element={<MyAlbumPage />} />
        <Route path="/my-album/:albumId" element={<MyAlbumDetailPage />} />
        <Route path="/mypage" element={<MyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

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
