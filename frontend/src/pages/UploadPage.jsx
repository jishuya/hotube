import { createUploadPreview } from '../utils/imagePreview';
import { hashFile } from '../utils/fileHash';
import { parseTags } from '../utils/tags';
import { getDefaultSharedWith } from '../utils/familySharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { parse as parseExif } from 'exifr';
import { getVideoDate } from '../utils/videoDate';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';
import UploadProgressDialog from '../components/common/UploadProgressDialog';
import ToastContainer from '../components/common/Toast';
import DatePickerField, { DateRangePicker } from '../components/common/DatePickerField';
import CustomSelect from '../components/common/CustomSelect';
import { fetchVideoInfoByUrl } from '../services/youtubeService';
import { addVideo, checkMediaDuplicates, deleteVideo, getMediaPage, toMemoryMedia, updateVideo, uploadMediaFile } from '../services/videoApi';
import { useAuth } from '../contexts/AuthContext';
import { listPendingUploadIds, getPendingUpload, removePendingUpload, savePendingUpload } from '../services/uploadQueueDb';

const ITEMS_PER_PAGE = 30;
const MAX_UPLOAD_FILES = 10;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 150 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_SIZE = 500 * 1024 * 1024;
const formatUploadSize = (bytes) => {
  const mb = bytes / (1024 * 1024);
  return mb > 0 && mb < 0.1 ? '0.1MB 미만' : `${Number(mb.toFixed(1))}MB`;
};

const SHARE_OPTIONS = [
  { value: 'dad', label: '아빠가족' },
  { value: 'mom', label: '엄마가족' },
];
const ALL_FAMILY_CATEGORIES = SHARE_OPTIONS.map((option) => option.value);

// 브라우저에서 읽을 수 없는 코덱은 업로드 후 서버에서 길이를 검사한다.
const readVideoDuration = (file, signal) => new Promise((resolve) => {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  const finish = (duration) => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
    resolve(duration);
  };
  const abort = () => finish(null);
  const timer = setTimeout(() => finish(null), 10000);
  if (signal?.aborted) return finish(null);
  signal?.addEventListener('abort', abort, { once: true });
  video.preload = 'metadata';
  video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : null);
  video.onerror = () => finish(null);
  video.src = url;
});

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

const addOneDay = (dateKey) => {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
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
  if (file.type.startsWith('video/')) {
    const date = await getVideoDate(file);
    if (date) return { date, source: 'video' };
  }
  if (file.type.startsWith('image/')) {
    try {
      const metadata = await parseExif(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
      const capturedAt = metadata?.DateTimeOriginal || metadata?.CreateDate || metadata?.ModifyDate;
      const capturedDate = capturedAt instanceof Date ? capturedAt : new Date(capturedAt);
      if (capturedAt && !Number.isNaN(capturedDate.getTime())) {
        return { date: formatFileDate(capturedDate), source: 'exif' };
      }
    } catch {
      // 촬영정보를 읽을 수 없으면 오늘 날짜를 사용한다.
    }
  }
  return { date: getTodayDateKey(), source: 'today' };
};

const extractYouTubeId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^?&/]+)/);
  return match?.[1] || '';
};

const getUploadFailureMessage = (error) => {
  if (error.name === 'AbortError') return '업로드를 중지했어요. 다시 누르면 남은 파일을 이어서 올립니다.';
  const message = String(error?.message || '').toLowerCase();
  if (error instanceof TypeError || message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')) {
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 후 다시 시도해주세요.';
  }
  if (message.includes('too large') || message.includes('파일이 너무 큽니다')) {
    return '파일 용량이 너무 커서 업로드하지 못했습니다. 더 작은 파일을 선택해주세요.';
  }
  return error.message || '업로드하지 못했습니다. 다시 누르면 이어서 올립니다.';
};

const UploadPage = ({ embedded = false, initialDate = getTodayDateKey(), targetDate = '', listOnly = false }) => {
  const { user } = useAuth();
  const canShareCouple = ['admin', 'sub-admin'].includes(user?.role);
  const navigate = useNavigate();
  const [uploads, setUploads] = useState([]);
  const [uploadSource, setUploadSource] = useState('device');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeInfo, setYoutubeInfo] = useState(null);
  const [fetchingYoutube, setFetchingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [tags, setTags] = useState('');
  const [sharedWith, setSharedWith] = useState(() => getDefaultSharedWith(user));
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMoreUploads, setLoadingMoreUploads] = useState(false);
  const uploadListSentinelRef = useRef(null);
  const loadingMoreUploadsRef = useRef(false);
  const uploadFeedVersionRef = useRef(0);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [filterTag, setFilterTag] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [editingUpload, setEditingUpload] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState(0);
  const [transfer, setTransfer] = useState(null);
  const [batchBytes, setBatchBytes] = useState({ total: 0, completed: 0 });
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [queueNotice, setQueueNotice] = useState('');
  const operationControllerRef = useRef(null);
  const preparingRef = useRef(false);
  const manuallyPausedRef = useRef(false);
  const previewUrlsRef = useRef(new Set());
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [uploadError, setUploadError] = useState('');
  const [uploadFailureMessage, setUploadFailureMessage] = useState('');
  const [fileSelectionNotice, setFileSelectionNotice] = useState('');
  const [toasts, setToasts] = useState([]);
  const [resumeVersion, setResumeVersion] = useState(0);
  const resumeStartedRef = useRef('');
  const uploadInProgressRef = useRef(false);
  const showToast = useCallback((message, type = 'info') => {
    setToasts((current) => [...current, {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      duration: 5000,
    }]);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const selectedUploadSize = selectedFiles.reduce((sum, item) => sum + (item.file?.size ?? item.size ?? 0), 0);
  const transferredBytes = Math.min(batchBytes.total, batchBytes.completed + (transfer?.loaded || 0));
  const uploadPercent = batchBytes.total > 0 ? Math.floor(transferredBytes / batchBytes.total * 100) : null;
  const progressOpen = preparing || uploading;
  const hasDateFilter = Boolean(filterDateFrom || filterDateTo);
  const dateFilterError = filterDateFrom && filterDateTo && filterDateFrom > filterDateTo
    ? '종료일은 시작일보다 빠를 수 없어요.'
    : '';
  const hasActiveFilters = Boolean(hasDateFilter || filterTag.trim() || filterSource !== 'all' || filterMediaType !== 'all');

  useEffect(() => {
    const currentUrls = new Set(selectedFiles.map((item) => item.preview).filter(Boolean));
    for (const url of previewUrlsRef.current) {
      if (!currentUrls.has(url)) URL.revokeObjectURL(url);
    }
    previewUrlsRef.current = currentUrls;
  }, [selectedFiles]);

  useEffect(() => () => {
    operationControllerRef.current?.abort();
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (uploadInProgressRef.current || preparingRef.current || manuallyPausedRef.current) return;
      resumeStartedRef.current = '';
      setResumeVersion((current) => current + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    if (listOnly || !user?.id || uploadInProgressRef.current || resumeStartedRef.current === user.id) return;
    resumeStartedRef.current = user.id;
    let active = true;
    let ownsUpload = false;
    let resumeController;
    listPendingUploadIds(user.id)
      .then(async (records) => {
        if (!active || !records.length || uploadInProgressRef.current || preparingRef.current) return;
        setResumeAvailable(true);
        uploadInProgressRef.current = true;
        ownsUpload = true;
        setUploading(true);
        setTransfer(null);
        setBatchBytes({ total: 0, completed: 0 });
        const controller = new AbortController();
        resumeController = controller;
        operationControllerRef.current = controller;
        setUploadProgress({ completed: 0, total: records.length });
        let totalBytes = 0;
        for (const id of records) {
          controller.signal.throwIfAborted();
          const record = await getPendingUpload(id);
          totalBytes += record?.file?.size || 0;
        }
        if (!active) return;
        setBatchBytes({ total: totalBytes, completed: 0 });
        let completed = 0;
        for (const id of records) {
          if (controller.signal.aborted) break;
          const record = await getPendingUpload(id);
          if (!record) continue;
          setTransfer(null);
          try {
            controller.signal.throwIfAborted();
            await uploadMediaFile(record.file, record.options, {
              signal: controller.signal,
              onProgress: (progress) => { if (active) setTransfer({ ...progress, name: record.file.name }); },
            });
            await removePendingUpload(record.id).catch(() => {});
            setBatchBytes((current) => ({ ...current, completed: current.completed + record.file.size }));
            setTransfer(null);
            completed += 1;
            setUploadProgress((current) => ({ ...current, completed: current.completed + 1 }));
          } catch (error) {
            if (error.code === 'DUPLICATE_MEDIA') {
              await removePendingUpload(record.id);
              setBatchBytes((current) => ({ ...current, total: Math.max(0, current.total - record.file.size) }));
              setTransfer(null);
              continue;
            }
            if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
              await removePendingUpload(record.id).catch(() => {});
              if (active) setUploadFailureMessage(getUploadFailureMessage(error));
              setBatchBytes((current) => ({ ...current, total: Math.max(0, current.total - record.file.size) }));
              setTransfer(null);
              continue;
            }
            if (active) setUploadFailureMessage(getUploadFailureMessage(error));
            break;
          }
        }
        if (active) setResumeAvailable((await listPendingUploadIds(user.id)).length > 0);
        if (active && completed) {
          showToast(`중단된 업로드 ${completed}개를 완료했어요.`, 'success');
          window.dispatchEvent(new Event('hotube:media-updated'));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ownsUpload) return;
        uploadInProgressRef.current = false;
        operationControllerRef.current = null;
        if (active) { setUploading(false); setTransfer(null); }
      });
    return () => {
      active = false;
      resumeController?.abort();
      if (!ownsUpload) resumeStartedRef.current = '';
    };
  }, [listOnly, resumeVersion, showToast, user?.id]);

  useEffect(() => {
    if (!listOnly) return;
    let active = true;
    if (dateFilterError) {
      setUploads([]);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      uploadFeedVersionRef.current += 1;
      loadingMoreUploadsRef.current = false;
      setLoadingMoreUploads(false);
      getMediaPage({
        search: filterTag.trim().replace(/^#/, ''),
        dateFrom: filterDateFrom,
        dateTo: addOneDay(filterDateTo),
        source: filterSource,
        mediaType: filterMediaType,
        limit: ITEMS_PER_PAGE,
      })
        .then((result) => {
          if (!active) return;
          const mappedItems = result.items.map(toMemoryMedia);
          setUploads(mappedItems);
          setNextCursor(result.nextCursor);
        })
        .catch((error) => {
          if (active) setUploadError(error.message);
        });
    }, filterTag.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [listOnly, filterDateFrom, filterDateTo, filterTag, filterSource, filterMediaType, hasActiveFilters, dateFilterError]);

  const loadMoreUploads = useCallback(async () => {
    if (!nextCursor || loadingMoreUploadsRef.current || dateFilterError) return;
    const feedVersion = uploadFeedVersionRef.current;
    loadingMoreUploadsRef.current = true;
    setLoadingMoreUploads(true);
    try {
      const result = await getMediaPage({
        search: filterTag.trim().replace(/^#/, ''),
        dateFrom: filterDateFrom,
        dateTo: addOneDay(filterDateTo),
        source: filterSource,
        mediaType: filterMediaType,
        limit: ITEMS_PER_PAGE,
      }, nextCursor);
      if (feedVersion !== uploadFeedVersionRef.current) return;
      setUploads((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...result.items.map(toMemoryMedia).filter((item) => !existingIds.has(item.id))];
      });
      setNextCursor(result.nextCursor);
    } catch (error) {
      if (feedVersion === uploadFeedVersionRef.current) setUploadError(error.message);
    } finally {
      if (feedVersion === uploadFeedVersionRef.current) {
        loadingMoreUploadsRef.current = false;
        setLoadingMoreUploads(false);
      }
    }
  }, [dateFilterError, filterDateFrom, filterDateTo, filterMediaType, filterSource, filterTag, nextCursor]);

  useEffect(() => {
    const target = uploadListSentinelRef.current;
    if (!listOnly || !target || !nextCursor) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMoreUploads();
    }, { rootMargin: '500px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [listOnly, loadMoreUploads, nextCursor]);

  const addFiles = async (files) => {
    if (preparingRef.current || uploadInProgressRef.current) return;
    preparingRef.current = true;
    setPreparing(true);
    setPreparationProgress(0);
    const controller = new AbortController();
    operationControllerRef.current = controller;
    const newPreviewUrls = [];
    let selectionCommitted = false;
    try {
      const availableSlots = Math.max(0, MAX_UPLOAD_FILES - selectedFiles.length);
      const selectedMediaFiles = Array.from(files).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
      if (availableSlots === 0) {
        setFileSelectionNotice(`최대 ${MAX_UPLOAD_FILES}개까지 첨부할 수 있어요. 추가 파일은 제외했어요.`);
        return;
      }
      const selectionNotices = [];
      const oversizedImages = selectedMediaFiles.filter((file) => file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE);
      const oversizedVideos = selectedMediaFiles.filter((file) => file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE);
      const sizeEligibleFiles = selectedMediaFiles.filter((file) => (
        !(file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE)
        && !(file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE)
      ));
      const countExcludedFiles = sizeEligibleFiles.slice(availableSlots);
      const countEligibleFiles = sizeEligibleFiles.slice(0, availableSlots);
      const mediaFiles = [];
      let totalSize = selectedUploadSize;
      let longVideoCount = 0;
      let totalSizeExceededCount = 0;

      // 전체 준비 진행률: 기본 검사 10%, 파일 읽기 80%, 중복 조회 5%, 미리보기 5%.
      for (const [index, file] of countEligibleFiles.entries()) {
        setPreparationProgress(Math.floor(index / countEligibleFiles.length * 10));
        if (file.type.startsWith('video/')) {
          controller.signal.throwIfAborted();
          const duration = await readVideoDuration(file, controller.signal);
          controller.signal.throwIfAborted();
          if (duration !== null && duration > 90) {
            longVideoCount += 1;
            continue;
          }
        }
        if (totalSize + file.size > MAX_TOTAL_UPLOAD_SIZE) {
          totalSizeExceededCount += 1;
          continue;
        }
        mediaFiles.push(file);
        totalSize += file.size;
      }

      if (longVideoCount) selectionNotices.push(`영상 길이 초과 ${longVideoCount}개 (최대 1분 30초)`);
      if (totalSizeExceededCount) selectionNotices.push(`전체 용량 초과 ${totalSizeExceededCount}개 (최대 500MB)`);
      if (countExcludedFiles.length) {
        selectionNotices.push(`개수 초과 ${countExcludedFiles.length}개 (최대 ${MAX_UPLOAD_FILES}개)`);
      }
      if (oversizedImages.length) {
        selectionNotices.push(`사진 용량 초과 ${oversizedImages.length}개 (개당 최대 20MB)`);
      }
      if (oversizedVideos.length) {
        selectionNotices.push(`영상 용량 초과 ${oversizedVideos.length}개 (개당 최대 150MB)`);
      }

      if (!mediaFiles.length) {
        if (selectionNotices.length) {
          setFileSelectionNotice(selectionNotices.join('\n'));
        }
        return;
      }
      setPreparationProgress(10);
      let hashedFiles;
      try {
        hashedFiles = [];
        const totalBytes = mediaFiles.reduce((sum, file) => sum + file.size, 0);
        let checkedBytes = 0;
        for (const file of mediaFiles) {
          const contentHash = await hashFile(file, (loaded) => {
            setPreparationProgress(10 + Math.floor(Math.min(1, (checkedBytes + loaded) / (totalBytes || 1)) * 80));
          }, controller.signal);
          checkedBytes += file.size;
          hashedFiles.push({ file, contentHash });
        }
        setPreparationProgress(90);
        const duplicateHashes = new Set(await checkMediaDuplicates(hashedFiles.map(({ contentHash }) => contentHash), controller.signal));
        const selectedHashes = new Set(selectedFiles.map((item) => item.contentHash).filter(Boolean));
        const acceptedHashes = new Set();
        const duplicateNames = [];
        hashedFiles = hashedFiles.filter(({ file, contentHash }) => {
          const duplicate = duplicateHashes.has(contentHash)
            || selectedHashes.has(contentHash)
            || acceptedHashes.has(contentHash);
          if (duplicate) duplicateNames.push(file.name);
          else acceptedHashes.add(contentHash);
          return !duplicate;
        });
        setUploadError('');
        if (duplicateNames.length) {
          selectionNotices.push(`중복 ${duplicateNames.length}개`);
        }
        if (selectionNotices.length) {
          setFileSelectionNotice(selectionNotices.join('\n'));
        }
      } catch (error) {
        if (error.name !== 'AbortError') setUploadError(error.message || '중복 파일을 확인하지 못했습니다');
        return;
      }
      setPreparationProgress(95);
      const nextFiles = [];
      for (const { file, contentHash } of hashedFiles) {
        controller.signal.throwIfAborted();
        const mediaDate = await getMediaDate(file);
        controller.signal.throwIfAborted();
        const preview = file.type.startsWith('image/') ? await createUploadPreview(file) : URL.createObjectURL(file);
        if (preview) { previewUrlsRef.current.add(preview); newPreviewUrls.push(preview); }
        controller.signal.throwIfAborted();
        nextFiles.push({
          file, contentHash, name: file.name,
          type: file.type.startsWith('video/') ? 'video' : 'photo', preview,
          date: targetDate || mediaDate.date,
          tags: '',
        });
        setPreparationProgress(95 + Math.floor(nextFiles.length / hashedFiles.length * 5));
      }
      setPreparationProgress(100);
      selectionCommitted = true;
      setSelectedFiles((current) => [...current, ...nextFiles]);
    } catch (error) {
      if (error.name !== 'AbortError') setUploadError(error.message || '파일을 확인하지 못했습니다.');
    } finally {
      if (!selectionCommitted) for (const url of newPreviewUrls) { URL.revokeObjectURL(url); previewUrlsRef.current.delete(url); }
      preparingRef.current = false;
      operationControllerRef.current = null;
      setPreparing(false);
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const resetForm = () => {
    setUploadSource('device');
    setSelectedFiles([]);
    setYoutubeUrl('');
    setYoutubeInfo(null);
    setYoutubeError('');
    setTitle('');
    setTags('');
    setSharedWith(getDefaultSharedWith(user));
  };

  const toggleSharedFamily = (category) => {
    setSharedWith((current) => {
      if (!current.includes(category)) return [...current, category];
      const next = current.filter((value) => value !== category);
      return next.length > 0 ? next : current;
    });
  };

  const changeUploadSource = (source) => {
    setUploadSource(source);
    if (source === 'device') {
      setYoutubeUrl('');
      setYoutubeInfo(null);
      setYoutubeError('');
    } else {
      setSelectedFiles([]);
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
    if (uploadInProgressRef.current || preparingRef.current) return;
    if (!user?.id) {
      setUploadError('로그인 사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
      return;
    }
    const youtubeId = extractYouTubeId(youtubeUrl.trim());
    const normalizedTags = parseTags(tags);
    setUploading(true);
    setTransfer(null);
    setBatchBytes({ total: uploadSource === 'device' ? selectedUploadSize : 0, completed: 0 });
    manuallyPausedRef.current = false;
    const controller = new AbortController();
    operationControllerRef.current = controller;
    setQueueNotice('');
    uploadInProgressRef.current = true;
    setUploadProgress({ completed: 0, total: uploadSource === 'device' ? selectedFiles.length : 1 });
    setUploadError('');
    setUploadFailureMessage('');
    try {
      const created = [];
      const duplicateFiles = [];
      if (uploadSource === 'device') {
        const uploadBatchId = crypto.randomUUID();
        const optionsFor = (item) => {
          return {
            title: item.name,
            uploadedAt: targetDate || item.date || date,
            tags: normalizedTags,
            uploadedBy: user.id,
            sharedWith,
            uploadBatchId,
            contentHash: item.contentHash,
          };
        };
        let completed = 0;
        const failures = [];
        for (const item of selectedFiles) {
          if (controller.signal.aborted) break;
          const pendingId = `${user.id}:${item.contentHash}`;
          setTransfer({ phase: 'saving', loaded: 0, total: item.file.size, name: item.name });
          try {
            // Persist only the file about to be sent, rather than copying the whole batch first.
            await savePendingUpload({ id: pendingId, userId: user.id, file: item.file, options: optionsFor(item) }, controller.signal);
          } catch (error) {
            if (error.name !== 'AbortError') setQueueNotice('이 기기에 임시 저장할 수 없어 앱을 닫으면 파일을 다시 선택해야 해요.');
          }
          try {
            controller.signal.throwIfAborted();
            const saved = await uploadMediaFile(item.file, optionsFor(item), {
              signal: controller.signal,
              onProgress: (progress) => setTransfer({ ...progress, name: item.name }),
            });
            created.push(toMemoryMedia(saved));
            await removePendingUpload(pendingId).catch(() => {});
          } catch (error) {
            if (error.code === 'DUPLICATE_MEDIA') {
              duplicateFiles.push(item.name);
              await removePendingUpload(pendingId).catch(() => {});
            } else {
              failures.push(`${item.name}: ${getUploadFailureMessage(error)}`);
              if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
                await removePendingUpload(pendingId).catch(() => {});
              }
              // Keep this file and all remaining files selected for retry. No background workers remain.
              break;
            }
          }
          setBatchBytes((current) => ({ ...current, completed: current.completed + item.file.size }));
          setTransfer(null);
          completed += 1;
          setUploadProgress((current) => ({ ...current, completed }));
          setSelectedFiles((current) => current.filter((entry) => entry.contentHash !== item.contentHash));
        }
        if (failures.length || controller.signal.aborted) {
          if (created.length) {
            setUploads((current) => [...created, ...current]);
            window.dispatchEvent(new Event('hotube:media-updated'));
            showToast(`${created.length}개 업로드 완료. 남은 파일만 다시 올릴 수 있어요.`, 'info');
          }
          setUploadFailureMessage(failures.join('\n') || '업로드를 중지했어요. 남은 파일은 다시 누르면 이어서 올립니다.');
          return;
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
          sharedWith,
        }, { signal: controller.signal });
        created.push(toMemoryMedia(saved));
        setUploadProgress({ completed: 1, total: 1 });
      }
      if (created.length === 0) {
        if (duplicateFiles.length) {
          setUploadError(`이미 업로드된 파일이라 제외했어요: ${duplicateFiles.join(', ')}`);
        }
        return;
      }
      setUploads((current) => [...created, ...current]);
      resetForm();
      window.dispatchEvent(new Event('hotube:media-updated'));
      const uploadedMedia = created[0];
      const uploadedMonth = uploadedMedia.date?.slice(0, 7);
      const returnTo = uploadedMonth ? `/calendar?month=${uploadedMonth}` : '/calendar';
      const processingVideoCount = created.filter((media) => media.processingStatus === 'processing').length;
      navigate(`/media/${uploadedMedia.id}?date=${encodeURIComponent(uploadedMedia.date || '')}`, {
        replace: true,
        state: {
          returnTo,
          uploadSuccessMessage: `${created.length}개의 미디어가 업로드되었습니다.${processingVideoCount ? ` 영상 ${processingVideoCount}개는 재생 준비 중입니다.` : ''}${duplicateFiles.length ? ` 중복 파일 ${duplicateFiles.length}개는 제외했어요: ${duplicateFiles.join(', ')}` : ''}`,
        },
      });
    } catch (error) {
      setUploadFailureMessage(getUploadFailureMessage(error));
    } finally {
      uploadInProgressRef.current = false;
      operationControllerRef.current = null;
      setTransfer(null);
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
      setDeleteTarget(null);
      window.dispatchEvent(new Event('hotube:media-updated'));
    } catch (error) {
      setUploadError(error.message);
    }
  };

  return (
    <>
      {!embedded && <Header showSearch={false} />}
      <main className={`${embedded ? 'bg-surface px-4 pb-8 pt-4' : 'min-h-screen bg-background px-4 pb-32 pt-0'} text-text-primary`}>
        <div className="mx-auto max-w-4xl bg-transparent">
          {!listOnly ? (
            <form onSubmit={handleUpload} className="space-y-5">
              <fieldset disabled={uploading || preparing} className="space-y-5 min-w-0">
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
                        className={`flex min-h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${selectedFiles.length >= MAX_UPLOAD_FILES ? 'cursor-not-allowed border-border bg-gray-100 opacity-70' : 'cursor-pointer border-primary/35 bg-primary/5 hover:border-primary hover:bg-primary/10'}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          addFiles(event.dataTransfer.files);
                        }}
                      >
                        <Icon icon="mdi:image-plus-outline" className="mb-3 text-5xl text-primary" />
                        <span className="mt-3 text-sm font-extrabold text-orange-700 dark:text-orange-300">
                          <span>한 번에 최대 10개 첨부<br /><span className="text-xs font-semibold">영상은 개당 1분 30초 이하</span></span>
                        </span>
                        {selectedFiles.length > 0 && (
                          <span className="mt-3 flex w-full max-w-xs flex-col gap-2 text-sm font-bold text-primary" aria-live="polite">
                            <span
                              role="progressbar"
                              aria-label="첨부 파일 용량"
                              aria-valuemin={0}
                              aria-valuemax={MAX_TOTAL_UPLOAD_SIZE}
                              aria-valuenow={selectedUploadSize}
                              aria-valuetext={`${formatUploadSize(selectedUploadSize)} / 500MB`}
                              className="h-2 w-full overflow-hidden rounded-full bg-primary/15"
                            >
                              <span className="block h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.min(100, selectedUploadSize / MAX_TOTAL_UPLOAD_SIZE * 100)}%` }} />
                            </span>
                            <span>{selectedFiles.length}/{MAX_UPLOAD_FILES}개({formatUploadSize(selectedUploadSize)}/500MB)</span>
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          disabled={selectedFiles.length >= MAX_UPLOAD_FILES}
                          className="sr-only"
                          onChange={(event) => {
                            addFiles(event.target.files);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <p className="mt-2 text-center text-xs text-text-secondary">*개당 용량: 사진 20MB · 영상 150MB 이하</p>

                      {selectedFiles.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <div>
                            <p className="text-sm font-bold">선택한 파일</p>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                            {selectedFiles.map((item, index) => (
                              <div key={`${item.name}-${index}`} className="relative min-w-0 overflow-hidden rounded-lg bg-gray-100 p-0.5 text-left" title={item.name}>
                                  <span className="relative block aspect-square overflow-hidden rounded-md bg-black/5">
                                    {item.type === 'video' ? (
                                      <>
                                        <VideoFramePreview src={item.preview} className="h-full w-full object-cover" />
                                        <Icon icon="mdi:play-circle" className="pointer-events-none absolute bottom-1 left-1 text-sm text-white drop-shadow" aria-hidden="true" />
                                      </>
                                    ) : (
                                    <img src={item.preview} alt={item.name} className="h-full w-full object-cover" />
                                    )}
                                  </span>
                                <span className="mt-0.5 block truncate px-0.5 text-[10px] leading-4">{item.name}</span>
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
                                  className="absolute right-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                                  aria-label={`${item.name} 제거`}
                                >
                                  <Icon icon="mdi:close" />
                                </span>
                              </div>
                            ))}
                          </div>


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
                {uploadSource !== 'device' && (
                  <label>
                    <span className="mb-2 block text-sm font-bold">태그</span>
                    <input value={tags} onChange={(event) => setTags(event.target.value)} className="h-11 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" placeholder="#가족 #여행 #생일" />
                  </label>
                )}
                <fieldset className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <legend className="text-sm font-bold">공유 가족</legend>
                    <button
                      type="button"
                      onClick={() => setSharedWith(ALL_FAMILY_CATEGORIES)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      모두 선택
                    </button>
                  </div>
                  <div className={`grid gap-1.5 ${canShareCouple ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {canShareCouple && (
                      <button
                        type="button"
                        onClick={() => setSharedWith([])}
                        aria-pressed={sharedWith.length === 0}
                        className={`flex min-h-10 items-center justify-center gap-1 whitespace-nowrap rounded-xl border px-1 py-1.5 text-xs font-bold transition sm:text-sm ${sharedWith.length === 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-text-secondary hover:border-primary/40'}`}
                      >
                        <Icon icon={sharedWith.length === 0 ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="shrink-0 text-lg" />
                        부부
                      </button>
                    )}
                    {SHARE_OPTIONS.map(({ value, label }) => {
                      const selected = sharedWith.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleSharedFamily(value)}
                          aria-pressed={selected}
                          className={`flex min-h-10 items-center justify-center gap-1 whitespace-nowrap rounded-xl border px-1 py-1.5 text-xs font-bold transition sm:text-sm ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-text-secondary hover:border-primary/40'}`}
                        >
                          <Icon icon={selected ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="shrink-0 text-lg" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </section>

              </fieldset>
              {uploadError && <p className="rounded-lg bg-error/10 p-3 text-sm font-semibold text-error">{uploadError}</p>}
              {!uploading && !preparing && resumeAvailable && selectedFiles.length === 0 && (
                <button type="button" className="text-sm font-bold text-primary underline" onClick={() => {
                  manuallyPausedRef.current = false;
                  resumeStartedRef.current = '';
                  setResumeVersion((current) => current + 1);
                }}>중단된 업로드 다시 시도</button>
              )}
              {queueNotice && <p className="text-xs text-text-secondary">{queueNotice}</p>}
              <button type="submit" disabled={uploading || preparing || (selectedFiles.length === 0 && !youtubeInfo)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-white shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
                <Icon icon={uploading ? 'mdi:loading' : 'mdi:cloud-upload'} className={`text-xl ${uploading ? 'animate-spin' : ''}`} />
                {uploading
                  ? `업로드 중 · ${uploadProgress.completed}/${uploadProgress.total}`
                  : preparing ? `파일 확인 중 · ${preparationProgress}%` : '업로드하기'}
              </button>
            </form>
          ) : (
            <section>
              <div className="mb-5 mt-2">
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-2xl font-extrabold">업로드 목록</h1>
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {nextCursor ? `${uploads.length}개 이상` : `${uploads.length}개`}
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
                      }}
                      className="h-10 w-full rounded-lg border-border bg-background pl-9 text-sm focus:border-primary focus:ring-primary"
                      placeholder="태그, 제목 검색"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTag('');
                      setFilterDateFrom('');
                      setFilterDateTo('');
                      setFilterSource('all');
                      setFilterMediaType('all');
                      setDateFilterOpen(false);
                    }}
                    disabled={!hasActiveFilters}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="검색 필터 초기화"
                    title="검색 필터 초기화"
                  >
                    <Icon icon="mdi:refresh" className="text-lg" />
                  </button>
                </div>
                <div className="col-span-3 grid grid-cols-2 gap-2">
                  <div className="relative order-last col-span-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setDateFilterOpen((current) => !current)}
                      className={`flex h-10 w-full items-center justify-between gap-1 rounded-lg border bg-white px-3 text-left text-sm transition ${dateFilterOpen ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'} ${hasDateFilter ? 'pr-8' : ''}`}
                      aria-label="검색 기간 설정"
                      aria-expanded={dateFilterOpen}
                    >
                      <span className={`min-w-0 flex-1 truncate ${hasDateFilter ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {hasDateFilter ? `${filterDateFrom || '시작일'} ~ ${filterDateTo || '종료일'}` : '전체 날짜'}
                      </span>
                      {!hasDateFilter && <Icon icon={dateFilterOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="shrink-0 text-xl text-text-secondary" />}
                    </button>
                    {hasDateFilter && (
                      <button
                        type="button"
                        onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary"
                        aria-label="날짜 초기화"
                        title="날짜 초기화"
                      >
                        <Icon icon="mdi:close" className="text-lg" />
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                  <span className="sr-only">업로드 출처</span>
                  <CustomSelect
                    value={filterSource}
                    onChange={(event) => {
                      setFilterSource(event.target.value);
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
              </div>

              {dateFilterOpen && (
                <div className="mb-3 mt-2 rounded-2xl border border-border bg-surface p-3 shadow-sm">
                  <div className="flex items-center gap-3 px-1 pb-2">
                    <span className="text-sm font-bold text-text-primary">검색 기간</span>
                    {hasDateFilter && (
                      <span className="ml-auto truncate text-xs font-medium text-primary">
                        {filterDateFrom || '시작일'} ~ {filterDateTo || '종료일'}
                      </span>
                    )}
                    {hasDateFilter && (
                      <button
                        type="button"
                        onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary"
                        aria-label="날짜 초기화"
                        title="날짜 초기화"
                      >
                        <Icon icon="mdi:close" className="text-lg" />
                      </button>
                    )}
                  </div>
                  <DateRangePicker
                    from={filterDateFrom}
                    to={filterDateTo}
                    onChange={(range) => {
                      setFilterDateFrom(range.from);
                      setFilterDateTo(range.to);
                      if (range.to) setDateFilterOpen(false);
                    }}
                  />
                  {dateFilterError && <p className="mt-2 text-xs font-semibold text-error">{dateFilterError}</p>}
                </div>
              )}

              {uploads.length > 0 ? (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                  {uploads.map((item) => (
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
                        <button type="button" onClick={() => setEditingUpload({ ...item, tagsText: (item.tags || []).map((tag) => `#${tag}`).join(' ') })} className="flex size-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary" aria-label={`${item.title} 수정`}>
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

              {nextCursor && (
                <div ref={uploadListSentinelRef} className="flex min-h-16 items-center justify-center" aria-live="polite">
                  {loadingMoreUploads && <><Icon icon="mdi:loading" className="animate-spin text-xl text-primary" /><span className="ml-2 text-sm text-text-secondary">더 불러오는 중...</span></>}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {progressOpen && <UploadProgressDialog
        title={preparing ? '영상 준비 중' : '업로드 중'}
        percent={preparing ? preparationProgress : uploadPercent}
        onStop={() => { manuallyPausedRef.current = true; operationControllerRef.current?.abort(); }}
        stopLabel="취소"
      />}

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
              <label className="block"><span className="mb-1 block text-sm font-bold">태그</span><input value={editingUpload.tagsText} onChange={(event) => setEditingUpload((current) => ({ ...current, tagsText: event.target.value, tags: parseTags(event.target.value) }))} className="w-full rounded-lg border-border bg-background focus:border-primary focus:ring-primary" /></label>
            </div>
            <button type="submit" className="mt-5 h-10 w-full rounded-full bg-primary font-bold text-white">수정 저장</button>
          </form>
        </div>
      ), document.body)}

      <Modal
        isOpen={!progressOpen && Boolean(uploadFailureMessage)}
        onClose={() => setUploadFailureMessage('')}
        title="업로드 실패"
        message={uploadFailureMessage}
        confirmText="확인"
      />
      <Modal
        isOpen={!progressOpen && Boolean(fileSelectionNotice)}
        onClose={() => setFileSelectionNotice('')}
        title="일부 파일을 제외했어요"
        message={fileSelectionNotice}
        confirmText="확인"
      />
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="업로드 삭제"
        message={`'${deleteTarget?.title || ''}'을(를) 삭제할까요?`}
        type="confirm"
        confirmText="삭제"
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
};

export default UploadPage;
