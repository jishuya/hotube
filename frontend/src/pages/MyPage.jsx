import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';
import PasswordChangeModal from '../components/common/PasswordChangeModal';
import ProfileEditModal from '../components/common/ProfileEditModal';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, updateUser as updateUserApi } from '../services/authApi';
import { createSupportRequest } from '../services/supportApi';

const roleLabels = {
  admin: '관리자',
  'sub-admin': '부관리자',
  user: '일반 회원',
};

const avatars = [
  { id: 'grandfather', x: 0, y: 9, label: '할아버지' },
  { id: 'grandmother-curly', x: 25, y: 9, label: '곱슬머리 할머니' },
  { id: 'woman-long', x: 50, y: 9, label: '긴 머리 여성' },
  { id: 'woman-short', x: 75, y: 9, label: '짧은 머리 여성' },
  { id: 'woman-glasses', x: 100, y: 9, label: '안경 쓴 여성' },
  { id: 'man', x: 0, y: 89, label: '성인 남성' },
  { id: 'man-glasses', x: 25, y: 89, label: '안경 쓴 남성' },
  { id: 'grandmother-bob', x: 50, y: 89, label: '단발머리 할머니' },
  { id: 'woman-ponytail', x: 75, y: 89, label: '머리 묶은 여성' },
  { id: 'man-short', x: 100, y: 89, label: '짧은 머리 남성' },
];

const getAvatarStyle = (avatar) => ({
  backgroundImage: "url('/avatars/hotube-family-avatars.png')",
  backgroundPosition: `${avatar.x}% ${avatar.y}%`,
  backgroundSize: '500% auto',
  backgroundRepeat: 'no-repeat',
});

const MyPage = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser, isAdmin } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [supportType, setSupportType] = useState(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [supportFiles, setSupportFiles] = useState([]);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [supportReceipt, setSupportReceipt] = useState(null);

  const categoryLabel = CATEGORIES.find((item) => item.value === user?.category)?.label || '미설정';
  const displayName = user?.name || user?.title || 'HoTube 가족';
  const selectedAvatar = avatars.find((item) => item.id === user?.avatar) || avatars[2];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const selectAvatar = async (avatarId) => {
    try {
      const savedUser = await updateUserApi(user.id, {
        name: user.name,
        title: user.title,
        category: user.category,
        avatar: avatarId,
      });
      updateUser(savedUser);
      setShowAvatarModal(false);
    } catch (error) {
      console.error('프로필 캐릭터 저장 실패:', error);
    }
  };

  const closeSupport = () => {
    setSupportType(null);
    setSupportMessage('');
    setSupportSent(false);
    setSupportFiles([]);
    setSupportBusy(false);
    setSupportError('');
    setSupportReceipt(null);
  };

  const submitSupport = async (event) => {
    event.preventDefault();
    if (!supportMessage.trim() || supportBusy) return;
    setSupportBusy(true);
    setSupportError('');
    try {
      const receipt = await createSupportRequest({
        userId: user.id,
        requestType: supportType,
        message: supportMessage.trim(),
        files: supportFiles,
      });
      setSupportReceipt(receipt);
      setSupportSent(true);
      setSupportMessage('');
      setSupportFiles([]);
    } catch (error) {
      setSupportError(error.message || '문의를 접수하지 못했습니다');
    } finally {
      setSupportBusy(false);
    }
  };

  const addSupportFiles = (fileList) => {
    const selectedFiles = Array.from(fileList || []);
    if (supportFiles.length + selectedFiles.length > 5) {
      setSupportError('이미지는 최대 5장까지 첨부할 수 있습니다.');
      return;
    }
    const invalidFile = selectedFiles.find((file) => !file.type.startsWith('image/'));
    if (invalidFile) {
      setSupportError('이미지 파일만 첨부할 수 있습니다.');
      return;
    }
    const oversizedFile = selectedFiles.find((file) => file.size > 5 * 1024 * 1024);
    if (oversizedFile) {
      setSupportError('첨부 이미지는 한 장당 5MB 이하여야 합니다.');
      return;
    }
    setSupportError('');
    setSupportFiles((current) => [...current, ...selectedFiles]);
  };

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background px-4 pb-16 text-text-primary">
        <div className="mx-auto max-w-2xl">
          <section className="rounded-2xl bg-surface p-5 shadow-sm sm:p-7" aria-labelledby="profile-title">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                className="relative flex size-20 shrink-0 items-center justify-center overflow-visible rounded-full bg-primary/10 shadow-sm transition hover:scale-105"
                aria-label="프로필 캐릭터 변경"
              >
                <span className="size-full overflow-hidden rounded-full" role="img" aria-label={selectedAvatar.label} style={getAvatarStyle(selectedAvatar)} />
                <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-primary text-white">
                  <Icon icon="mdi:pencil" className="text-sm" />
                </span>
              </button>
              <div className="min-w-0">
                <h1 id="profile-title" className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-2xl font-bold">{displayName}</span>
                </h1>
                <p className="mt-1 text-sm text-text-secondary">사랑스런 수호의 엄마</p>
              </div>
            </div>
          </section>

          <section className="mt-6" aria-labelledby="account-title">
            <h2 id="account-title" className="mb-3 text-xl font-bold">계정 정보</h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl bg-surface px-5 shadow-sm">
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3 text-text-secondary">
                  <Icon icon="mdi:account-outline" className="text-xl text-primary" />
                  <span className="text-sm font-semibold">아이디</span>
                </div>
                <span className="truncate text-sm font-bold">{user?.userId || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3 text-text-secondary">
                  <Icon icon="mdi:account-group-outline" className="text-xl text-primary" />
                  <span className="text-sm font-semibold">가족 구분</span>
                </div>
                <span className="text-sm font-bold">{categoryLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3 text-text-secondary">
                  <Icon icon="mdi:shield-account-outline" className="text-xl text-primary" />
                  <span className="text-sm font-semibold">계정 권한</span>
                </div>
                <span className="text-sm font-bold">{roleLabels[user?.role] || '일반 회원'}</span>
              </div>
            </div>
          </section>

          <section className="mt-6" aria-labelledby="settings-title">
            <h2 id="settings-title" className="mb-3 text-xl font-bold">설정</h2>
            <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left transition hover:bg-primary/5"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon icon="mdi:account-edit-outline" className="text-xl" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">회원정보 수정</span>
                  <span className="mt-0.5 block text-xs text-text-secondary">프로필과 비밀번호를 변경할 수 있어요.</span>
                </span>
                <Icon icon="mdi:chevron-right" className="text-xl text-text-secondary" />
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left transition hover:bg-primary/5"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon icon="mdi:lock-reset" className="text-xl" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">비밀번호 변경</span>
                  <span className="mt-0.5 block text-xs text-text-secondary">안전한 비밀번호로 변경할 수 있어요.</span>
                </span>
                <Icon icon="mdi:chevron-right" className="text-xl text-text-secondary" />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate('/upload-list')}
                  className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left transition hover:bg-primary/5"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon icon="mdi:format-list-bulleted" className="text-xl" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">업로드 목록</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">업로드한 사진과 영상을 관리할 수 있어요.</span>
                  </span>
                  <Icon icon="mdi:chevron-right" className="text-xl text-text-secondary" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-error transition hover:bg-error/5"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-error/10">
                  <Icon icon="mdi:logout" className="text-xl" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold">로그아웃</span>
                <Icon icon="mdi:chevron-right" className="text-xl" />
              </button>
            </div>
          </section>

          <section className="mt-6" aria-labelledby="support-title">
            <h2 id="support-title" className="mb-3 text-xl font-bold">고객센터</h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-sm">
              {[
                ['inquiry', 'mdi:message-question-outline', '문의하기', '서비스 이용에 궁금한 점을 남겨주세요.'],
                ['bug', 'mdi:bug-outline', '오류 리포트', '발견한 문제를 알려주시면 확인할게요.'],
              ].map(([type, icon, label, description]) => (
                <button key={type} type="button" onClick={() => setSupportType(type)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-primary/5">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon icon={icon} className="text-xl" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>
                  </span>
                  <Icon icon="mdi:chevron-right" className="text-xl text-text-secondary" />
                </button>
              ))}
              {isAdmin && (
                <button type="button" onClick={() => navigate('/support-management')} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-primary/5">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon icon="mdi:message-cog-outline" className="text-xl" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">고객의 소리 관리</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">접수된 문의와 오류 리포트를 확인하고 관리해요.</span>
                  </span>
                  <Icon icon="mdi:chevron-right" className="text-xl text-text-secondary" />
                </button>
              )}
            </div>
          </section>
        </div>
      </main>

      <ProfileEditModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        onUpdate={updateUser}
      />
      <PasswordChangeModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} userId={user?.id} />

      {showAvatarModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setShowAvatarModal(false)} aria-label="닫기" />
          <section className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" aria-labelledby="avatar-title">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 id="avatar-title" className="text-xl font-bold">프로필 캐릭터</h2><p className="mt-1 text-sm text-text-secondary">나를 표현할 캐릭터를 선택하세요.</p></div>
              <button type="button" onClick={() => setShowAvatarModal(false)} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10" aria-label="닫기"><Icon icon="mdi:close" className="text-xl" /></button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {avatars.map((avatar) => (
                <button key={avatar.id} type="button" onClick={() => selectAvatar(avatar.id)} className={`flex aspect-square items-center justify-center overflow-hidden rounded-xl transition hover:bg-primary/10 ${selectedAvatar.id === avatar.id ? 'bg-primary/10 ring-2 ring-primary' : 'bg-background'}`} title={avatar.label} aria-label={avatar.label}>
                  <span className="size-full" aria-hidden="true" style={getAvatarStyle(avatar)} />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {supportType && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={closeSupport} aria-label="닫기" />
          <section className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">{supportType === 'bug' ? '오류 리포트' : '문의하기'}</h2>
              <button type="button" onClick={closeSupport} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10" aria-label="닫기"><Icon icon="mdi:close" className="text-xl" /></button>
            </div>
            {supportSent ? (
              <div className="py-8 text-center">
                <Icon icon="mdi:check-circle" className="mx-auto text-5xl text-success" />
                <p className="mt-3 font-bold">소중한 의견이 접수되었습니다.</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {supportReceipt?.emailSent
                    ? '관리자에게 메일 알림도 전송했어요.'
                    : '접수 내용은 안전하게 저장되었어요.'}
                </p>
                <button type="button" onClick={closeSupport} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">확인</button>
              </div>
            ) : (
              <form onSubmit={submitSupport}>
                <label className="text-sm font-semibold">
                  내용
                  <textarea
                    value={supportMessage}
                    onChange={(event) => {
                      setSupportMessage(event.target.value);
                      setSupportError('');
                    }}
                    required
                    maxLength="5000"
                    rows="6"
                    disabled={supportBusy}
                    className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-3 focus:border-primary focus:ring-primary/30 disabled:opacity-60"
                    placeholder={supportType === 'bug' ? '오류가 발생한 화면과 상황을 자세히 적어주세요.' : '궁금한 점이나 의견을 적어주세요.'}
                  />
                </label>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold">사진 첨부 <span className="font-normal text-text-secondary">(선택, 최대 5장·장당 5MB)</span></p>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 px-4 py-4 text-sm font-bold text-primary transition hover:border-primary hover:bg-primary/10">
                    <Icon icon="mdi:image-plus-outline" className="text-xl" />
                    사진 선택
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={supportBusy}
                      className="sr-only"
                      onChange={(event) => {
                        addSupportFiles(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {supportFiles.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {supportFiles.map((file, index) => (
                        <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs">
                          <Icon icon="mdi:image-outline" className="shrink-0 text-lg text-primary" />
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <button type="button" disabled={supportBusy} onClick={() => setSupportFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-error/10 hover:text-error disabled:opacity-50" aria-label={`${file.name} 삭제`}>
                            <Icon icon="mdi:close" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {supportError && (
                  <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-error">
                    <Icon icon="mdi:alert-circle-outline" className="mt-0.5 shrink-0 text-lg" />
                    {supportError}
                  </p>
                )}
                <button type="submit" disabled={supportBusy || !supportMessage.trim()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {supportBusy && <Icon icon="mdi:loading" className="animate-spin text-xl" />}
                  {supportBusy ? '접수 중...' : '접수하기'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        type="confirm"
        title="로그아웃"
        message="HoTube에서 로그아웃할까요?"
        confirmText="로그아웃"
      />
    </>
  );
};

export default MyPage;
