import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { parse as parseExif } from 'exifr';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';
import DatePickerField from '../components/common/DatePickerField';
import CustomSelect from '../components/common/CustomSelect';
import { fetchVideoInfoByUrl } from '../services/youtubeService';
import { addVideo, deleteVideo, getAllVideos, toMemoryMedia, updateVideo, uploadMediaFile } from '../services/videoApi';
import { useAuth } from '../contexts/AuthContext';

const ITEMS_PER_PAGE = 20;

const VideoFramePreview = ({ src, className }) => (
  <video
    src={src}
    muted
    playsInline
    preload="metadata"
    className={className}
    onLoadedMetadata={(event) => {
      const video = event.currentTarget;
      const previewTime = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, video.duration / 2)
        : 0;
      if (previewTime > 0) video.currentTime = previewTime;
    }}
  />
);

const getTodayDateKey = () => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
};

const formatFileDate = (value) => {
  const fileDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(fileDate.getTime())) return getTodayDateKey();
  return [
    fileDate.getFullYear(),
    String(fileDate.getMonth() + 1).padStart(2, '0'),
    String(fileDate.getDate()).padStart(2, '0'),
  ].join('-');
};

const getMediaDate = async (file) => {
  if (file.type.startsWith('image/')) {
    try {
      const metadata = await parseExif(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
      const capturedAt = metadata?.DateTimeOriginal || metadata?.CreateDate || metadata?.ModifyDate;
      if (capturedAt) return formatFileDate(capturedAt);
    } catch {
      // EXIF가 없거나 읽을 수 없는 이미지는 파일 수정일을 사용한다.
    }
  }
  return formatFileDate(file.lastModified || Date.now());
};

const extractYouTubeId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^?&/]+)/);
  return match?.[1] || '';
};

const UploadPage = ({ embedded = false, initialDate = getTodayDateKey(), targetDate = '', listOnly = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState([]);
  const [totalUploadCount, setTotalUploadCount] = useState(0);
  const [availableDates, setAvailableDates] = useState([]);
  const [uploadSource, setUploadSource] = useState('device');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeInfo, setYoutubeInfo] = useState(null);
  const [fetchingYoutube, setFetchingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [tags, setTags] = useState('');
  const [page, setPage] = useState(1);
  const [filterDate, setFilterDate] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [editingUpload, setEditingUpload] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const selectedFile = selectedFileIndex === null ? null : selectedFiles[selectedFileIndex];
  const totalPages = Math.max(1, Math.ceil(uploads.length / ITEMS_PER_PAGE));
  const paginatedUploads = useMemo(() => uploads.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  ), [uploads, page]);
  const hasActiveFilters = Boolean(filterDate || filterTag.trim() || filterSource !== 'all' || filterMediaType !== 'all');

  useEffect(() => {
    if (!listOnly) return;
    let active = true;
    const timer = window.setTimeout(() => {
      getAllVideos({
        search: filterTag.trim().replace(/^#/, ''),
        uploadedAt: filterDate,
        source: filterSource,
        mediaType: filterMediaType,
      })
        .then((items) => {
          if (!active) return;
          const mappedItems = items.map(toMemoryMedia);
          setUploads(mappedItems);
          if (!hasActiveFilters) {
            setTotalUploadCount(mappedItems.length);
            setAvailableDates(Array.from(new Set(mappedItems.map((item) => item.date).filter(Boolean))).sort((a, b) => b.localeCompare(a)));
          }
        })
        .catch((error) => {
          if (active) setUploadError(error.message);
        });
    }, filterTag.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [listOnly, filterDate, filterTag, filterSource, filterMediaType, hasActiveFilters]);

  const addFiles = (files) => {
    const mediaFiles = Array.from(files).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    Promise.all(mediaFiles.map((file) => new Promise((resolve) => {
      if (file.type.startsWith('video/')) {
        getMediaDate(file).then((mediaDate) => resolve({
          file,
          name: file.name,
          type: 'video',
          preview: null,
          date: targetDate || mediaDate,
          tags: '',
        }));
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const mediaDate = await getMediaDate(file);
        resolve({
          file,
          name: file.name,
          type: file.type.startsWith('video/') ? 'video' : 'photo',
          preview: reader.result,
          date: targetDate || mediaDate,
          tags: '',
        });
      };
      reader.readAsDataURL(file);
    }))).then((nextFiles) => {
      setSelectedFiles((current) => [...current, ...nextFiles]);
      if (nextFiles.length > 0) setSelectedFileIndex((current) => current ?? 0);
    });
  };

  const updateSelectedFile = (index, field, value) => {
    setSelectedFiles((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const removeSelectedFile = (index) => {
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
    let nextSelectedIndex = selectedFileIndex;

    if (nextFiles.length === 0) {
      nextSelectedIndex = null;
    } else if (selectedFileIndex > index) {
      nextSelectedIndex = selectedFileIndex - 1;
    } else if (selectedFileIndex === index) {
      nextSelectedIndex = Math.min(index, nextFiles.length - 1);
    }

    setSelectedFiles(nextFiles);
    setSelectedFileIndex(nextSelectedIndex);
  };

  const resetForm = () => {
    setUploadSource('device');
    setSelectedFiles([]);
    setSelectedFileIndex(null);
    setYoutubeUrl('');
    setYoutubeInfo(null);
    setYoutubeError('');
    setTitle('');
    setTags('');
  };

  const changeUploadSource = (source) => {
    setUploadSource(source);
    if (source === 'device') {
      setYoutubeUrl('');
      setYoutubeInfo(null);
      setYoutubeError('');
    } else {
      setSelectedFiles([]);
      setSelectedFileIndex(null);
    }
  };

  const handleFetchYoutubeInfo = async () => {
    if (!youtubeUrl.trim()) {
      setYoutubeError('유튜브 URL을 입력해주세요.');
      return;
    }

    setFetchingYoutube(true);
    setYoutubeError('');
    try {
      const videoInfo = await fetchVideoInfoByUrl(youtubeUrl.trim());
      setYoutubeInfo(videoInfo);
      setTitle(videoInfo.title);
      setDate(targetDate || videoInfo.uploadedAt);
      if (videoInfo.tags?.length) setTags(videoInfo.tags.join(', '));
    } catch (error) {
      setYoutubeInfo(null);
      setYoutubeError(error.message);
    } finally {
      setFetchingYoutube(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!user?.id) {
      setUploadError('로그인 사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
      return;
    }
    const youtubeId = extractYouTubeId(youtubeUrl.trim());
    const normalizedTags = tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean);
    setUploading(true);
    setUploadError('');
    try {
      const created = [];
      if (uploadSource === 'device') {
        for (const item of selectedFiles) {
          const itemTags = item.tags.split(',')
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean);
          const saved = await uploadMediaFile(item.file, {
            title: item.name,
            uploadedAt: targetDate || item.date || date,
            tags: itemTags,
            dateTags: normalizedTags,
            uploadedBy: user?.id,
          });
          created.push(toMemoryMedia(saved));
        }
      } else if (youtubeId && youtubeInfo) {
        const saved = await addVideo({
          videoId: youtubeInfo.videoId,
          title: title.trim() || youtubeInfo.title,
          description: youtubeInfo.description || '',
          youtubeUrl: youtubeUrl.trim(),
          thumbnailUrl: youtubeInfo.thumbnailUrl,
          type: youtubeInfo.type,
          year: Number(date.slice(0, 4)),
          tags: normalizedTags,
          uploadedAt: targetDate || date,
          durationSeconds: youtubeInfo.durationInSeconds,
          viewCount: youtubeInfo.viewCount,
          likeCount: youtubeInfo.likeCount,
          channelTitle: youtubeInfo.channelTitle,
          uploadedBy: user?.id,
          sharedWith: ['dad', 'mom'],
        });
        created.push(toMemoryMedia(saved));
      }
      if (created.length === 0) return;
      setUploads((current) => [...created, ...current]);
      resetForm();
      setPage(1);
      window.dispatchEvent(new Event('hotube:media-updated'));
      const uploadedMedia = created[0];
      const uploadedMonth = uploadedMedia.date?.slice(0, 7);
      const returnTo = uploadedMonth ? `/calendar?month=${uploadedMonth}` : '/calendar';
      navigate(`/media/${uploadedMedia.id}?date=${encodeURIComponent(uploadedMedia.date || '')}`, {
        replace: true,
        state: {
          returnTo,
          uploadSuccessMessage: created.length > 1
            ? `${created.length}개의 미디어가 업로드되었습니다.`
            : '미디어가 업로드되었습니다.',
        },
      });
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    try {
      const saved = toMemoryMedia(await updateVideo(editingUpload.id, {
        title: editingUpload.title,
        uploadedAt: editingUpload.date,
        tags: editingUpload.tags,
      }));
      setUploads((current) => current.map((item) => item.id === saved.id ? saved : item));
      setEditingUpload(null);
      window.dispatchEvent(new Event('hotube:media-updated'));
    } catch (error) {
      setUploadError(error.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteVideo(deleteTarget.id);
      setUploads((current) => current.filter((item) => item.id !== deleteTarget.id));
      setTotalUploadCount((current) => Math.max(0, current - 1));
      setPage(1);
      setDeleteTarget(null);
      window.dispatchEvent(new Event('hotube:media-updated'));
    } catch (error) {
      setUploadError(error.message);
    }
  };

  return (
    <>
      {!embedded && <Header showSearch={false} />}
      <main className={`${embedded ? 'bg-surface px-4 pb-8 pt-4' : 'min-h-screen bg-background px-4 pb-16 pt-0'} text-text-primary`}>
        <div className="mx-auto max-w-4xl bg-transparent">
          {!listOnly ? (
            <form onSubmit={handleUpload} className="space-y-5">
              {targetDate && (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                  <Icon icon="mdi:calendar-check" className="text-xl" />
                  {targetDate} 날짜에 추가됩니다.
                </div>
              )}
              <section className="rounded-xl bg-transparent p-5 sm:p-6">
                <div className="rounded-xl border border-border p-4 sm:p-5">
                  <fieldset className="mb-4 flex w-full rounded-full bg-gray-100 p-1 shadow-inner">
                    <legend className="sr-only">업로드 방식</legend>
                    {[
                      ['device', '내 기기', 'mdi:devices'],
                      ['youtube', '유투브', 'mdi:youtube'],
                    ].map(([value, label, icon]) => (
                      <label key={value} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${uploadSource === value ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-primary'}`}>
                        <input type="radio" name="uploadSource" value={value} checked={uploadSource === value} onChange={() => changeUploadSource(value)} className="sr-only" />
                        <Icon icon={icon} className="text-lg" />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {uploadSource === 'device' ? (
                    <>
                      <label
                        className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 px-4 py-8 text-center transition hover:border-primary hover:bg-primary/10"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          addFiles(event.dataTransfer.files);
                        }}
                      >
                        <Icon icon="mdi:image-plus-outline" className="mb-3 text-5xl text-primary" />
                        <span className="font-bold">사진 또는 영상 선택</span>
                        <span className="mt-1 text-xs text-text-secondary">여러 파일을 한번에 선택할 수 있어요.</span>
                        <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(event) => addFiles(event.target.files)} />
                      </label>

                      {selectedFiles.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <div>
                            <p className="text-sm font-bold">선택한 파일</p>
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {selectedFiles.map((item, index) => (
                              <button type="button" key={`${item.name}-${index}`} onClick={() => setSelectedFileIndex(index)} className={`relative w-24 shrink-0 overflow-hidden rounded-xl border-2 p-1 text-left transition ${selectedFileIndex === index ? 'border-primary bg-primary/10' : 'border-transparent bg-gray-100 hover:border-primary/30'}`}>
                                {item.type !== 'video' && (
                                  <span className="block aspect-square overflow-hidden rounded-lg bg-black/5">
                                    <img src={item.preview} alt={item.name} className="h-full w-full object-cover" />
                                  </span>
                                )}
                                <span className="mt-1 block truncate px-1 text-xs">{item.name}</span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeSelectedFile(index);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      removeSelectedFile(index);
                                    }
                                  }}
                                  className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                                  aria-label={`${item.name} 제거`}
                                >
                                  <Icon icon="mdi:close" />
                                </span>
                              </button>
                            ))}
                          </div>

                          {selectedFile && selectedFiles.length > 1 && (
                            <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <p className="truncate text-sm font-bold">{selectedFile.name}</p>
                              </div>
                              <label>
                                <span className="mb-1 block text-xs font-bold">개별 태그</span>
                                <input value={selectedFile.tags} onChange={(event) => updateSelectedFile(selectedFileIndex, 'tags', event.target.value)} className="h-10 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" placeholder="이 파일에만 적용할 태그" />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 px-4 py-5 text-center transition focus-within:border-primary focus-within:bg-primary/10">
                        <Icon icon="mdi:youtube" className="mb-3 text-5xl text-error" />
                        <p className="font-bold">유투브 가져오기</p>
                        <p className="mt-1 text-xs text-text-secondary">유투브 영상 주소를 입력하면 영상 정보를 자동으로 불러와요.</p>

                        <div className="mt-5 flex w-full max-w-xl flex-col gap-2">
                          <div className="flex min-h-12 min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-3 py-2 text-left shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                            <Icon icon="mdi:link-variant" className="mr-2 shrink-0 text-xl text-text-secondary" />
                            <input
                              value={youtubeUrl}
                              onChange={(event) => {
                                setYoutubeUrl(event.target.value);
                                setYoutubeInfo(null);
                                setYoutubeError('');
                              }}
                              type="url"
                              placeholder="https://www.youtube.com/watch?v=..."
                              aria-label="유투브"
                              className="min-w-0 flex-1 border-none bg-transparent p-0 text-sm placeholder:text-text-secondary focus:ring-0"
                            />
                          </div>
                          <button type="button" onClick={handleFetchYoutubeInfo} disabled={fetchingYoutube} className="h-10 w-full rounded-lg border border-primary/20 bg-primary/10 px-4 text-sm font-bold text-primary transition hover:border-primary/40 hover:bg-primary/20 disabled:opacity-50">
                            {fetchingYoutube ? '가져오는 중...' : '가져오기'}
                          </button>
                        </div>
                        {youtubeError && <p className="mt-2 w-full max-w-xl text-left text-xs font-medium text-error">{youtubeError}</p>}
                      </div>

                      {youtubeInfo && (
                        <div className="mt-4 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <img src={youtubeInfo.thumbnailUrl} alt="" className="aspect-video w-28 shrink-0 rounded-lg object-cover sm:w-36" />
                          <div className="min-w-0 py-1">
                            <p className="line-clamp-2 text-sm font-bold">{youtubeInfo.title}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-text-secondary">
                              <span className="rounded-full bg-surface px-2 py-1">{youtubeInfo.type === 'short' ? 'Short' : 'Long'}</span>
                              <span className="rounded-full bg-surface px-2 py-1">{youtubeInfo.uploadedAt}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              <section className="!mt-0 grid gap-4 rounded-xl bg-transparent p-5 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0">
                {uploadSource === 'youtube' && (
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold">제목</span>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" placeholder="제목을 입력하세요" />
                  </label>
                )}
                {uploadSource === 'youtube' && !targetDate && (
                  <DatePickerField
                    label="날짜"
                    value={date}
                    onChange={setDate}
                  />
                )}
                <label className={uploadSource === 'device' ? 'sm:col-span-2' : ''}>
                  <span className="mb-2 block text-sm font-bold">{uploadSource === 'device' ? '추억 태그' : '태그'}</span>
                  <input value={tags} onChange={(event) => setTags(event.target.value)} className="h-11 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" placeholder={uploadSource === 'device' ? '돌잔치, 수영장, 첫응가' : '가족, 여행, 생일'} />
                </label>
              </section>

              {uploadError && <p className="rounded-lg bg-error/10 p-3 text-sm font-semibold text-error">{uploadError}</p>}
              <button type="submit" disabled={uploading || (selectedFiles.length === 0 && !youtubeInfo)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-white shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
                <Icon icon={uploading ? 'mdi:loading' : 'mdi:cloud-upload'} className={`text-xl ${uploading ? 'animate-spin' : ''}`} />
                {uploading ? '업로드 중...' : '업로드하기'}
              </button>
            </form>
          ) : (
            <section>
              <div className="mb-5 mt-2">
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-2xl font-extrabold">업로드 목록</h1>
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {hasActiveFilters ? `${uploads.length}/${totalUploadCount}개` : `${totalUploadCount}개`}
                  </span>
                </div>
              </div>
              <div className="mb-2 mt-2 grid grid-cols-3 gap-2 py-1">
                <div className="col-span-3 flex gap-2">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">태그 또는 제목 검색</span>
                    <Icon icon="mdi:magnify" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-secondary" />
                    <input
                      value={filterTag}
                      onChange={(event) => {
                        setFilterTag(event.target.value);
                        setPage(1);
                      }}
                      className="h-10 w-full rounded-lg border-border bg-background pl-9 text-sm focus:border-primary focus:ring-primary"
                      placeholder="태그, 제목 검색"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTag('');
                      setFilterDate('');
                      setFilterSource('all');
                      setFilterMediaType('all');
                      setPage(1);
                    }}
                    disabled={!hasActiveFilters}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="검색 필터 초기화"
                    title="검색 필터 초기화"
                  >
                    <Icon icon="mdi:refresh" className="text-lg" />
                  </button>
                </div>
                <div className="min-w-0">
                  <span className="sr-only">날짜 선택</span>
                  <CustomSelect
                    value={filterDate}
                    onChange={(event) => {
                      setFilterDate(event.target.value);
                      setPage(1);
                    }}
                    aria-label="날짜 선택"
                    className="h-10 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary"
                    options={[
                      { value: '', label: '전체 날짜' },
                      ...availableDates.map((uploadDate) => ({ value: uploadDate, label: uploadDate })),
                    ]}
                  />
                </div>
                <div className="min-w-0">
                  <span className="sr-only">업로드 출처</span>
                  <CustomSelect
                    value={filterSource}
                    onChange={(event) => {
                      setFilterSource(event.target.value);
                      setPage(1);
                    }}
                    aria-label="업로드 출처"
                    className="h-10 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary"
                    options={[
                      { value: 'all', label: '전체 출처' },
                      { value: 'file', label: '내 기기' },
                      { value: 'youtube', label: '유투브' },
                    ]}
                  />
                </div>
                <div className="min-w-0">
                  <span className="sr-only">미디어 종류</span>
                  <CustomSelect
                    value={filterMediaType}
                    onChange={(event) => {
                      setFilterMediaType(event.target.value);
                      setPage(1);
                    }}
                    aria-label="미디어 종류"
                    className="h-10 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary"
                    options={[
                      { value: 'all', label: '전체 종류' },
                      { value: 'photo', label: '사진' },
                      { value: 'video', label: '영상' },
                    ]}
                  />
                </div>
              </div>

              {paginatedUploads.length > 0 ? (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                  {paginatedUploads.map((item) => (
                    <article key={item.id} className="flex items-center gap-3 p-3 transition hover:bg-gray-50 sm:px-4">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-black/5 sm:size-20">
                        {item.type === 'video' && item.source === 'file' && !item.thumbnail ? (
                          <VideoFramePreview src={item.src} className="h-full w-full object-cover" />
                        ) : (
                          <img src={item.thumbnail || item.src} alt={item.title} className="h-full w-full object-cover" />
                        )}
                        {item.type === 'video' && <Icon icon="mdi:play-circle" className="absolute left-1 top-1 text-xl text-white drop-shadow" />}
                        {item.source === 'youtube' && <Icon icon="mdi:youtube" className="absolute bottom-1 left-1 text-lg text-error drop-shadow" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-bold">{item.title}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
                          <span>{item.date}</span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{item.source === 'youtube' ? '유투브' : '내 기기'}</span>
                          {(item.tags || []).slice(0, 2).map((tag) => (
                            <span key={tag} className="max-w-24 truncate rounded-full bg-gray-100 px-2 py-0.5">#{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => setEditingUpload({ ...item, tagsText: (item.tags || []).join(', ') })} className="flex size-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary" aria-label={`${item.title} 수정`}>
                          <Icon icon="mdi:pencil-outline" className="text-lg" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(item)} className="flex size-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-error/10 hover:text-error" aria-label={`${item.title} 삭제`}>
                          <Icon icon="mdi:trash-can-outline" className="text-lg" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl bg-surface text-center shadow-sm">
                  <Icon icon={hasActiveFilters ? 'mdi:file-search-outline' : 'mdi:tray-arrow-up'} className="mb-3 text-5xl text-primary/40" />
                  <p className="font-bold">{hasActiveFilters ? '검색 조건에 맞는 미디어가 없어요.' : '아직 업로드한 미디어가 없어요.'}</p>
                </div>
              )}

              {totalPages > 1 && (
                <nav className="mt-7 flex items-center justify-center gap-1" aria-label="업로드 목록 페이지">
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-30"><Icon icon="mdi:chevron-left" /></button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`size-9 rounded-full text-sm font-bold ${page === pageNumber ? 'bg-primary text-white' : 'hover:bg-primary/10'}`}>{pageNumber}</button>
                  ))}
                  <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-30"><Icon icon="mdi:chevron-right" /></button>
                </nav>
              )}
            </section>
          )}
        </div>
      </main>

      {editingUpload && createPortal((
        <div className="fixed left-0 top-0 z-modal flex h-[100dvh] w-screen items-center justify-center overflow-hidden">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setEditingUpload(null)} aria-label="수정 창 닫기" />
          <form onSubmit={saveEdit} className="relative max-h-[76dvh] w-[calc(100vw-3rem)] max-w-xs overflow-x-hidden overflow-y-auto rounded-xl bg-surface p-4 shadow-xl sm:max-w-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">업로드 수정</h2>
              <button type="button" onClick={() => setEditingUpload(null)} className="text-2xl text-text-secondary"><Icon icon="mdi:close" /></button>
            </div>
            <div className="space-y-4">
              <label className="block"><span className="mb-1 block text-sm font-bold">제목</span><input value={editingUpload.title} onChange={(event) => setEditingUpload((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-lg border-border bg-background focus:border-primary focus:ring-primary" /></label>
              <DatePickerField
                label="날짜"
                value={editingUpload.date}
                onChange={(value) => setEditingUpload((current) => ({ ...current, date: value }))}
              />
              <label className="block"><span className="mb-1 block text-sm font-bold">태그</span><input value={editingUpload.tagsText} onChange={(event) => setEditingUpload((current) => ({ ...current, tagsText: event.target.value, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) }))} className="w-full rounded-lg border-border bg-background focus:border-primary focus:ring-primary" /></label>
            </div>
            <button type="submit" className="mt-5 h-10 w-full rounded-full bg-primary font-bold text-white">수정 저장</button>
          </form>
        </div>
      ), document.body)}

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="업로드 삭제"
        message={`'${deleteTarget?.title || ''}'을(를) 삭제할까요?`}
        type="confirm"
        confirmText="삭제"
      />
    </>
  );
};

export default UploadPage;
