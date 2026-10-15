import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import Cropper from 'react-easy-crop';
import { DayPicker } from '@daypicker/react';
import { ko } from '@daypicker/react/locale/ko';
import '@daypicker/react/style.css';
import { DayPickerDropdown } from './CustomSelect';
import Modal from './Modal';

const parseLocalDate = (value) => {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const readImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('사진을 불러오지 못했습니다.'));
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

const createCroppedImage = (imageSource, cropArea) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('지원하지 않는 이미지입니다.'));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const context = canvas.getContext('2d');
      context.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        600,
        600,
      );
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = imageSource;
});

const CHILD_LABELS = ['첫째', '둘째', '셋째'];

const ChildInfoForm = ({ child, label, onSave }) => {
  const formId = useId();
  const [formData, setFormData] = useState(child);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cropSource, setCropSource] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [showBirthdayCalendar, setShowBirthdayCalendar] = useState(false);
  const fileInputRef = useRef(null);

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있어요.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('사진은 10MB 이하만 업로드할 수 있어요.');
      return;
    }

    try {
      setCropSource(await readImage(file));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      event.target.value = '';
    }
  };

  const applyCrop = async () => {
    if (!cropSource || !croppedArea) return;
    setProcessingPhoto(true);
    try {
      updateField('profileImage', await createCroppedImage(cropSource, croppedArea));
      setCropSource(null);
    } catch (cropError) {
      setError(cropError.message);
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = formData.name.trim();
    const missingField = !name ? '이름을 입력해주세요.'
      : !formData.gender ? '성별을 선택해주세요.'
        : !formData.birthday ? '태어난 날을 선택해주세요.' : '';
    if (missingField) {
      setError(missingField);
      return;
    }
    if (new Date(`${formData.birthday}T00:00:00`) > new Date()) {
      setError('태어난 날은 오늘 이후로 설정할 수 없어요.');
      return;
    }
    setSaving(true);
    try {
      const savedChild = await onSave({ ...formData, name });
      setFormData(savedChild);
    } catch (saveError) {
      setError(saveError.message || '아이 정보를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
        <form onSubmit={handleSubmit} className="px-5 py-5">
          <h3 className="mb-4 text-lg font-bold text-text-primary">{label} 아이 정보수정</h3>
          <fieldset disabled={saving}>
          <div className="mb-5 flex flex-col items-center">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative size-24 rounded-full" aria-label="아이 사진 변경">
              {formData.profileImage ? <img src={formData.profileImage} alt="아이 사진 미리보기" className="size-full rounded-full border-2 border-white object-cover shadow-md ring-1 ring-border" /> : <span className="flex size-full items-center justify-center rounded-full bg-primary/10 text-primary"><Icon icon="mdi:baby-face-outline" className="text-5xl" /></span>}
              <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow-sm transition group-hover:scale-105">
                <Icon icon="mdi:camera" className="text-lg" />
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-text-primary" htmlFor={`${formId}-name`}>이름</label>
              <input id={`${formId}-name`} value={formData.name} onChange={(event) => updateField('name', event.target.value)} maxLength={30} placeholder="아이의 이름" className="h-11 w-full rounded-lg border-border bg-background px-4 text-text-primary focus:border-primary focus:ring-primary" />
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-text-primary">성별</legend>
              <div className="grid grid-cols-2 gap-2">
                {[['male', '남아', 'mdi:gender-male'], ['female', '여아', 'mdi:gender-female']].map(([value, label, icon]) => (
                  <button key={value} type="button" onClick={() => updateField('gender', value)} className={`flex h-11 items-center justify-center gap-2 rounded-lg border-2 font-semibold transition ${formData.gender === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:border-primary/40'}`}>
                    <Icon icon={icon} className="text-xl" />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-text-primary">태어난 날</span>
              <button
                type="button"
                onClick={() => setShowBirthdayCalendar((current) => !current)}
                className={`flex h-11 w-full items-center justify-between rounded-lg border bg-background px-4 text-left transition ${showBirthdayCalendar ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                aria-expanded={showBirthdayCalendar}
                aria-controls={`${formId}-birthday-calendar`}
              >
                <span className={formData.birthday ? 'font-medium text-text-primary' : 'text-text-secondary'}>
                  {formData.birthday
                    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(parseLocalDate(formData.birthday))
                    : '태어난 날을 선택하세요'}
                </span>
                <Icon icon="mdi:calendar-month-outline" className="text-xl text-primary" />
              </button>

              {showBirthdayCalendar && (
                <div id={`${formId}-birthday-calendar`} className="mt-2 overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-sm">
                  <DayPicker
                    mode="single"
                    locale={ko}
                    selected={parseLocalDate(formData.birthday)}
                    defaultMonth={parseLocalDate(formData.birthday) || new Date()}
                    onSelect={(date) => {
                      if (!date) return;
                      updateField('birthday', formatLocalDate(date));
                      setShowBirthdayCalendar(false);
                    }}
                    disabled={{ after: new Date() }}
                    startMonth={new Date(1990, 0)}
                    endMonth={new Date()}
                    captionLayout="dropdown"
                    components={{ Dropdown: DayPickerDropdown }}
                    reverseYears
                    className="child-birthday-picker"
                  />
                </div>
              )}
            </div>
          </div>

          {error && <p className="mt-4 flex items-center gap-2 rounded-lg bg-error/10 p-3 text-sm font-medium text-error"><Icon icon="mdi:alert-circle" className="shrink-0 text-lg" />{error}</p>}

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={saving} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
              {saving ? '저장 중...' : `${label} 정보 저장`}
            </button>
          </div>
          </fieldset>
        </form>

      {cropSource && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby={`${formId}-crop-title`}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 id={`${formId}-crop-title`} className="text-lg font-bold text-text-primary">사진 크기 조절</h3>
                <p className="mt-0.5 text-xs text-text-secondary">사진을 움직이고 확대해 얼굴을 맞춰주세요.</p>
              </div>
              <button type="button" onClick={() => setCropSource(null)} className="flex size-9 items-center justify-center rounded-full text-text-secondary hover:bg-primary/10" aria-label="사진 편집 취소">
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>

            <div className="relative h-[min(60vh,420px)] bg-black">
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedArea(pixels)}
              />
            </div>

            <div className="px-5 py-4">
              <label className="flex items-center gap-3 text-sm font-semibold text-text-secondary">
                <Icon icon="mdi:image-size-select-small" className="text-lg" />
                <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="h-2 flex-1 cursor-pointer accent-primary" aria-label="사진 확대 비율" />
                <Icon icon="mdi:image-size-select-large" className="text-xl" />
              </label>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => setCropSource(null)} disabled={processingPhoto} className="h-11 flex-1 rounded-lg border border-border font-semibold text-text-secondary disabled:opacity-50">취소</button>
                <button type="button" onClick={applyCrop} disabled={processingPhoto || !croppedArea} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-bold text-white disabled:opacity-60">
                  {processingPhoto && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
                  {processingPhoto ? '처리 중...' : '적용'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ChildInfoModal = ({ isOpen, onClose, children: childProfiles, onSave }) => {
  const [thirdChildDraft, setThirdChildDraft] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const handleSave = async (updatedChild, index) => {
    const savedChild = await onSave(updatedChild, index);
    setSavedMessage(`${CHILD_LABELS[index]} 아이 정보가 저장되었습니다.`);
    return savedChild;
  };
  const profiles = childProfiles.length < 3 && thirdChildDraft
    ? [...childProfiles, thirdChildDraft]
    : childProfiles;
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="child-info-title">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="닫기" />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 id="child-info-title" className="text-xl font-bold text-text-primary">아이 정보 수정</h2>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10" aria-label="닫기">
            <Icon icon="mdi:close" className="text-xl" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto divide-y divide-border">
          {profiles.map((child, index) => (
            <ChildInfoForm key={index} child={child} label={CHILD_LABELS[index]} onSave={(updatedChild) => handleSave(updatedChild, index)} />
          ))}
          {profiles.length < 3 && (
            <div className="px-5 py-5">
              <button
                type="button"
                onClick={() => setThirdChildDraft({ name: '', gender: '', birthday: '', profileImage: null })}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary font-bold text-primary transition hover:bg-primary/10"
              >
                <Icon icon="mdi:plus" className="text-xl" />
                셋째 추가
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    {savedMessage && (
      <Modal
        isOpen
        onClose={() => setSavedMessage('')}
        title="저장 완료"
        message={savedMessage}
      />
    )}
    </>
  );
};

export default ChildInfoModal;
