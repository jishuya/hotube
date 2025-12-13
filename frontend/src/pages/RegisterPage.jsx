import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { registerUser, TITLES, CATEGORIES } from '../services/authApi';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    userId: '',
    name: '',
    title: '',
    category: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 아이디 형식 검사
    if (!/^[a-zA-Z0-9]{3,20}$/.test(formData.userId)) {
      setError('아이디는 영문, 숫자 3-20자로 입력해주세요');
      return;
    }

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    // 비밀번호 검증: 8자 이상, 영문+숫자+특수문자 포함
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError('비밀번호는 8자 이상, 영문+숫자+특수문자를 포함해야 합니다');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...userData } = formData;
      const user = await registerUser(userData);
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

      {/* Register Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <Icon icon="mdi:account-plus" className="text-6xl text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-zinc-900">회원가입</h2>
              <p className="text-zinc-500 mt-2">가족 구성원 정보를 입력하세요</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 아이디 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  아이디
                </label>
                <input
                  type="text"
                  name="userId"
                  value={formData.userId}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="영문, 숫자 3-20자"
                  required
                />
              </div>

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  이름
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="실명을 입력하세요"
                  required
                />
              </div>

              {/* 호칭 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  호칭
                </label>
                <select
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white"
                  required
                >
                  <option value="">호칭을 선택하세요</option>
                  {TITLES.map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  가족 구분
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                      className={`h-11 rounded-lg border-2 font-medium transition-all ${
                        formData.category === cat.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
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
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="8자 이상, 영문+숫자+특수문자"
                  required
                />
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                  <Icon icon="mdi:alert-circle" className="text-lg shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 회원가입 버튼 */}
              <button
                type="submit"
                disabled={loading || !formData.category}
                className="w-full h-12 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Icon icon="mdi:loading" className="text-xl animate-spin" />
                    가입 중...
                  </>
                ) : (
                  '가입하기'
                )}
              </button>
            </form>

            {/* 로그인 링크 */}
            <p className="text-center text-zinc-500 mt-6">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;
