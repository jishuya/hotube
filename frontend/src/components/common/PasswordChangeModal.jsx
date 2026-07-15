import { useState } from 'react';
import { Icon } from '@iconify/react';
import { changePassword } from '../../services/authApi';

const initialForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

const PasswordChangeModal = ({ isOpen, onClose, userId }) => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const closeModal = () => {
    setForm(initialForm);
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const hasSpecialCharacter = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.newPassword);

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }
    if (form.newPassword.length < 5 || !hasSpecialCharacter) {
      setError('새 비밀번호는 5자 이상, 특수문자를 1개 이상 포함해야 합니다.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(userId, form.currentPassword, form.newPassword);
      setForm(initialForm);
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={closeModal} aria-label="닫기" />
      <section className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" aria-labelledby="password-modal-title">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="password-modal-title" className="text-xl font-bold">비밀번호 변경</h2>
          <button type="button" onClick={closeModal} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10" aria-label="닫기">
            <Icon icon="mdi:close" className="text-xl" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            ['currentPassword', '현재 비밀번호', '현재 비밀번호'],
            ['newPassword', '새 비밀번호', '5자 이상, 특수문자 1개 포함'],
            ['confirmPassword', '새 비밀번호 확인', '새 비밀번호를 다시 입력'],
          ].map(([name, label, placeholder]) => (
            <label key={name} className="block text-sm font-semibold">
              {label}
              <input
                type="password"
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-4 focus:border-primary focus:ring-primary/30"
              />
            </label>
          ))}
          {error && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{error}</p>}
          {success && <p className="rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">비밀번호가 변경되었습니다.</p>}
          <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-white disabled:opacity-50">
            {loading && <Icon icon="mdi:loading" className="animate-spin text-xl" />}
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default PasswordChangeModal;
