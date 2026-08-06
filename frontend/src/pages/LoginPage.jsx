import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { loginUser, USERS } from '../services/authApi';

const REMEMBER_ID_KEY = 'hotube_remember_id';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    userId: '',
    password: '',
  });
  const [rememberUserId, setRememberUserId] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 저장된 아이디 불러오기
  useEffect(() => {
    const savedUserId = localStorage.getItem(REMEMBER_ID_KEY);
    if (savedUserId) {
      setFormData(prev => ({ ...prev, userId: savedUserId }));
      setRememberUserId(true);
    }
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedUser = USERS.find(u => u.userId === formData.userId);

  const handleSelectUser = (userId) => {
    setFormData(prev => ({ ...prev, userId }));
    setIsDropdownOpen(false);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginUser(formData);

      // 아이디 기억하기 처리
      if (rememberUserId) {
        localStorage.setItem(REMEMBER_ID_KEY, formData.userId);
      } else {
        localStorage.removeItem(REMEMBER_ID_KEY);
      }

      if (rememberPassword && 'credentials' in navigator && 'PasswordCredential' in window) {
        try {
          const credential = new window.PasswordCredential({
            id: formData.userId,
            password: formData.password,
            name: selectedUser?.label || formData.userId,
          });
          await navigator.credentials.store(credential);
        } catch (credentialError) {
          console.error('비밀번호 관리자 저장 요청 실패:', credentialError);
        }
      }

      login(user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 w-full items-center border-b border-zinc-200 bg-background-light px-4 sm:px-10">
        <Link to="/login" className="flex items-center gap-2">
          <img src="/logo.svg" alt="HoTube" className="w-8 h-8" />
          <h1 className="text-xl font-bold text-[#181411]">HoTube</h1>
        </Link>
      </header>

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <Icon icon="mdi:account-circle" className="text-6xl text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-zinc-900">로그인</h2>
              <p className="text-zinc-500 mt-2">가족 영상을 함께 감상하세요</p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="on" className="space-y-5">
              {/* 아이디 (호칭 선택) - 커스텀 드롭다운 */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  아이디
                </label>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full h-11 px-4 rounded-lg border bg-white text-left flex items-center justify-between transition-colors ${
                    isDropdownOpen
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  <span className={selectedUser ? 'text-zinc-900' : 'text-zinc-400'}>
                    {selectedUser ? selectedUser.label : '호칭을 선택하세요'}
                  </span>
                  <Icon
                    icon={isDropdownOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                    className="text-xl text-zinc-400"
                  />
                </button>

                {/* 드롭다운 목록 */}
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {USERS.map(user => (
                      <button
                        key={user.userId}
                        type="button"
                        onClick={() => handleSelectUser(user.userId)}
                        className={`w-full px-4 py-2.5 text-left transition-colors ${
                          formData.userId === user.userId
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-zinc-700 hover:bg-primary/5 hover:text-primary'
                        }`}
                      >
                        {user.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* hidden input for form validation */}
                <input
                  type="text"
                  name="userId"
                  value={formData.userId}
                  autoComplete="username"
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                  className="sr-only"
                  required
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  비밀번호
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>

              {/* 로그인 정보 기억하기 */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex cursor-pointer select-none items-center text-sm text-zinc-600">
                  <input
                    type="checkbox"
                    checked={rememberUserId}
                    onChange={(e) => setRememberUserId(e.target.checked)}
                    className="size-4 cursor-pointer rounded border-zinc-300 text-primary focus:ring-primary/50"
                  />
                  <span className="ml-2">아이디 기억하기</span>
                </label>
                <label className="flex cursor-pointer select-none items-center text-sm text-zinc-600">
                  <input
                    type="checkbox"
                    checked={rememberPassword}
                    onChange={(e) => setRememberPassword(e.target.checked)}
                    className="size-4 cursor-pointer rounded border-zinc-300 text-primary focus:ring-primary/50"
                  />
                  <span className="ml-2">비밀번호 기억하기</span>
                </label>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                  <Icon icon="mdi:alert-circle" className="text-lg shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 로그인 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Icon icon="mdi:loading" className="text-xl animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </button>
            </form>

            {/* 회원가입 링크 - 주석처리 */}
            {/* <p className="text-center text-zinc-500 mt-6">
              계정이 없으신가요?{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">
                회원가입
              </Link>
            </p> */}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
