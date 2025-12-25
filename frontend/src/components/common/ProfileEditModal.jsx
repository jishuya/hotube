import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { TITLES, CATEGORIES, updateUser as updateUserApi, changePassword as changePasswordApi } from '../../services/authApi';

const ProfileEditModal = ({ isOpen, onClose, user, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    category: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // 사용자 정보로 폼 초기화
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        title: user.title || '',
        category: user.category || '',
      });
    }
  }, [user]);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setSuccess(false);
      setShowPasswordSection(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordError('');
      setPasswordSuccess(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setSuccess(false);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    setPasswordError('');
    setPasswordSuccess(false);
  };

  const validatePassword = (password) => {
    // 5자 이상, 특수문자 1개 이상 포함
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    return password.length >= 5 && hasSpecialChar;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('모든 필드를 입력해주세요');
      return;
    }

    if (!validatePassword(passwordData.newPassword)) {
      setPasswordError('비밀번호는 5자 이상, 특수문자를 1개 이상 포함해야 합니다');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다');
      return;
    }

    setLoading(true);

    try {
      await changePasswordApi(user.id, passwordData.currentPassword, passwordData.newPassword);
      setPasswordSuccess(true);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.name || !formData.title || !formData.category) {
      setError('모든 필드를 입력해주세요');
      return;
    }

    setLoading(true);

    try {
      const updatedUser = await updateUserApi(user.id, formData);
      onUpdate(updatedUser);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            회원정보 수정
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <Icon icon="mdi:close" className="text-xl text-zinc-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {/* 아이디 표시 (수정 불가) */}
        <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">아이디</p>
          <div className="flex items-center justify-between">
            <p className="font-medium text-zinc-900 dark:text-white">{user?.userId}</p>
            {user?.role === 'admin' && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                관리자
              </span>
            )}
            {user?.role === 'sub-admin' && (
              <span className="text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                부관리자
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              이름
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full h-11 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder="이름을 입력하세요"
              required
            />
          </div>

          {/* 호칭 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              호칭
            </label>
            <select
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full h-11 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
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
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
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
                      : 'border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-500'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <Icon icon="mdi:alert-circle" className="text-lg shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 성공 메시지 */}
          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <Icon icon="mdi:check-circle" className="text-lg shrink-0" />
              <span>회원정보가 수정되었습니다</span>
            </div>
          )}

          {/* 버튼들 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Icon icon="mdi:loading" className="text-xl animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </button>
          </div>
        </form>

        {/* 비밀번호 변경 섹션 */}
        <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors"
          >
            <Icon icon={showPasswordSection ? "mdi:chevron-up" : "mdi:chevron-down"} className="text-lg" />
            비밀번호 변경
          </button>

          {showPasswordSection && (
            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
              {/* 현재 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="현재 비밀번호"
                />
              </div>

              {/* 새 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="5자 이상, 특수문자 1개 포함"
                />
              </div>

              {/* 새 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full h-11 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="새 비밀번호 확인"
                />
              </div>

              {/* 비밀번호 에러 메시지 */}
              {passwordError && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <Icon icon="mdi:alert-circle" className="text-lg shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* 비밀번호 성공 메시지 */}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <Icon icon="mdi:check-circle" className="text-lg shrink-0" />
                  <span>비밀번호가 변경되었습니다</span>
                </div>
              )}

              {/* 비밀번호 변경 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-zinc-800 dark:bg-zinc-600 text-white font-semibold rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Icon icon="mdi:loading" className="text-xl animate-spin" />
                    변경 중...
                  </>
                ) : (
                  '비밀번호 변경'
                )}
              </button>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
