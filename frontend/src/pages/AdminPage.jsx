import { useState, useEffect, useCallback } from 'react';
import { fetchVideoInfoByUrl } from '../services/youtubeService';
import { getAllVideos, addVideo, updateVideo, deleteVideo } from '../services/videoApi';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';
import ToastContainer from '../components/common/Toast';

const AdminPage = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingVideo, setEditingVideo] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Form state - URL과 태그만 입력, 나머지는 자동
  const [formData, setFormData] = useState({
    youtubeUrl: '',
    tags: '',
    // 자동으로 채워지는 필드
    title: '',
    description: '',
    thumbnailUrl: '',
    type: 'video',
    year: new Date().getFullYear(),
    videoId: '',
    uploadedAt: new Date().toISOString().split('T')[0]
  });

  // 영상 정보 프리뷰 상태
  const [videoPreview, setVideoPreview] = useState(null);

  // 모달 상태 (confirm용)
  const [modal, setModal] = useState({
    isOpen: false,
    message: '',
    onConfirm: null
  });

  // 토스트 상태
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showConfirm = (message, onConfirm) => {
    setModal({
      isOpen: true,
      message,
      onConfirm
    });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const fetchedVideos = await getAllVideos();
      setVideos(fetchedVideos);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // YouTube URL 입력 후 정보 가져오기
  const handleFetchVideoInfo = async () => {
    if (!formData.youtubeUrl) {
      setFetchError('YouTube URL을 입력해주세요.');
      return;
    }

    setFetching(true);
    setFetchError('');

    try {
      const videoInfo = await fetchVideoInfoByUrl(formData.youtubeUrl);
      console.log('Fetched video info:', videoInfo);
      console.log('Duration in seconds:', videoInfo.durationInSeconds);

      setFormData(prev => ({
        ...prev,
        title: videoInfo.title,
        description: videoInfo.description,
        thumbnailUrl: videoInfo.thumbnailUrl,
        type: videoInfo.type,
        year: videoInfo.year,
        videoId: videoInfo.videoId,
        uploadedAt: videoInfo.uploadedAt,
        durationSeconds: videoInfo.durationInSeconds,
        viewCount: videoInfo.viewCount,
        likeCount: videoInfo.likeCount,
        channelTitle: videoInfo.channelTitle
      }));

      setVideoPreview(videoInfo);
    } catch (error) {
      setFetchError(error.message);
      setVideoPreview(null);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!videoPreview && !editingVideo) {
      setFetchError('먼저 "영상 정보 가져오기" 버튼을 클릭해주세요.');
      return;
    }

    try {
      const videoData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        year: parseInt(formData.year)
      };

      if (editingVideo) {
        await updateVideo(editingVideo.id, videoData);
        showToast('영상이 수정되었습니다!', 'success');
      } else {
        await addVideo(videoData);
        showToast('영상이 등록되었습니다!', 'success');
      }

      // Reset form
      setFormData({
        youtubeUrl: '',
        tags: '',
        title: '',
        description: '',
        thumbnailUrl: '',
        type: 'video',
        year: new Date().getFullYear(),
        videoId: '',
        uploadedAt: new Date().toISOString().split('T')[0]
      });
      setEditingVideo(null);
      setVideoPreview(null);
      loadVideos();
    } catch (error) {
      console.error('Error saving video:', error);
      showToast(error.message, 'error');
    }
  };

  const handleEdit = (video) => {
    setEditingVideo(video);
    setFormData({
      youtubeUrl: video.youtubeUrl,
      tags: video.tags ? video.tags.join(', ') : '',
      title: video.title,
      description: video.description || '',
      thumbnailUrl: video.thumbnailUrl,
      type: video.type,
      year: video.year,
      videoId: video.videoId || '',
      uploadedAt: video.uploadedAt || new Date().toISOString().split('T')[0]
    });
    setVideoPreview({
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      type: video.type,
      year: video.year
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (videoId) => {
    showConfirm('정말 이 영상을 삭제하시겠습니까?', async () => {
      try {
        await deleteVideo(videoId);
        showToast('영상이 삭제되었습니다!', 'success');
        loadVideos();
      } catch (error) {
        console.error('Error deleting video:', error);
        showToast(error.message, 'error');
      }
    });
  };

  const handleCancel = () => {
    setEditingVideo(null);
    setVideoPreview(null);
    setFetchError('');
    setFormData({
      youtubeUrl: '',
      tags: '',
      title: '',
      description: '',
      thumbnailUrl: '',
      type: 'video',
      year: new Date().getFullYear(),
      videoId: '',
      uploadedAt: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="relative flex min-h-screen w-full bg-background font-body text-text-primary">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        message={modal.message}
        type="confirm"
      />
      <div className="flex flex-col w-full">
        <Header isAdmin={true} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Video Registration Form */}
              <section className="lg:col-span-1 self-start">
                <div className="bg-surface rounded-xl shadow-sm p-6">
                  <h2 className="font-display text-text-primary text-xl font-semibold leading-tight mb-4">
                    {editingVideo ? '영상 수정' : '새 영상 등록'}
                  </h2>
                  <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
                    {/* YouTube URL 입력 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        YouTube URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          name="youtubeUrl"
                          value={formData.youtubeUrl}
                          onChange={handleInputChange}
                          className="form-input flex-1 min-w-0 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/80 border border-primary-200 bg-white h-10 placeholder:text-slate-400 px-3 text-sm font-normal leading-normal transition-colors"
                          placeholder="https://youtu.be/..."
                          required
                        />
                        <button
                          type="button"
                          onClick={handleFetchVideoInfo}
                          disabled={fetching}
                          className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-3 bg-slate-600 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {fetching ? '로딩...' : '정보 가져오기'}
                        </button>
                      </div>
                      {fetchError && (
                        <p className="text-red-500 text-sm mt-1">{fetchError}</p>
                      )}
                    </div>

                    {/* 영상 프리뷰 */}
                    {videoPreview && (
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2 font-medium">영상 정보 미리보기</p>
                        <div className="flex gap-3">
                          <img
                            src={videoPreview.thumbnailUrl}
                            alt="썸네일"
                            className="w-24 h-auto rounded aspect-video object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-text-primary line-clamp-2">
                              {videoPreview.title}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                {formData.type === 'shorts' ? 'Shorts' : 'Video'}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                                {formData.year}년
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 태그 입력 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        태그 (쉼표로 구분)
                      </label>
                      <input
                        name="tags"
                        value={formData.tags}
                        onChange={handleInputChange}
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/80 border border-primary-200 bg-white h-10 placeholder:text-slate-400 px-3 text-sm font-normal leading-normal transition-colors"
                        placeholder="예: 가족여행, 바닷가, 제주도"
                      />
                    </div>

                    {/* 타입/연도 수정 (선택적) */}
                    {videoPreview && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            타입 (자동 감지됨)
                          </label>
                          <select
                            name="type"
                            value={formData.type}
                            onChange={handleInputChange}
                            className="form-select flex w-full min-w-0 flex-1 overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/80 border border-primary-200 bg-white h-10 px-3 text-sm font-normal leading-normal transition-colors"
                          >
                            <option value="video">Video</option>
                            <option value="shorts">Shorts</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            연도 (자동 감지됨)
                          </label>
                          <select
                            name="year"
                            value={formData.year}
                            onChange={handleInputChange}
                            className="form-select flex w-full min-w-0 flex-1 overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/80 border border-primary-200 bg-white h-10 px-3 text-sm font-normal leading-normal transition-colors"
                          >
                            {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        className="flex flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-5 bg-primary text-white text-sm font-bold leading-normal tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        type="submit"
                        disabled={!videoPreview && !editingVideo}
                      >
                        <span className="truncate">{editingVideo ? '영상 수정' : '영상 등록'}</span>
                      </button>
                      {(editingVideo || videoPreview) && (
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-5 bg-zinc-200 text-zinc-800 text-sm font-bold leading-normal tracking-wide hover:bg-zinc-300 transition-colors"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </section>

              {/* Video List */}
              <section className="lg:col-span-2">
                <header className="flex flex-wrap justify-between items-center gap-3 mb-6">
                  <div>
                    <h1 className="font-display text-text-primary text-3xl font-bold leading-tight">
                      Admin DashBoard
                    </h1>
                    <p className="text-text-secondary mt-1">
                      가족 영상 라이브러리를 관리하세요.
                    </p>
                  </div>
                </header>

                <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
                  {loading ? (
                    <div className="flex justify-center items-center py-20">
                      <p className="text-slate-500">영상 로딩 중...</p>
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <span className="material-symbols-outlined text-6xl text-primary/30">
                        video_library
                      </span>
                      <p className="text-slate-500">아직 영상이 없습니다. 첫 번째 영상을 등록해보세요!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-border bg-slate-50">
                          <tr>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              썸네일
                            </th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              제목
                            </th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">
                              타입
                            </th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">
                              연도
                            </th>
                            <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              관리
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {videos.map((video) => (
                            <tr key={video.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 align-top">
                                <div
                                  className="bg-center bg-no-repeat aspect-video bg-cover rounded-lg w-32 h-auto"
                                  style={{ backgroundImage: `url('${video.thumbnailUrl}')` }}
                                ></div>
                              </td>
                              <td className="p-4 align-top max-w-xs">
                                <p className="font-semibold text-text-primary">{video.title}</p>
                                <dl className="mt-2 text-xs text-slate-500">
                                  <div className="md:hidden">
                                    <dt className="inline font-semibold">타입: </dt>
                                    <dd className="inline">{video.type}</dd>
                                  </div>
                                  <div className="lg:hidden">
                                    <dt className="inline font-semibold">연도: </dt>
                                    <dd className="inline">{video.year}</dd>
                                  </div>
                                </dl>
                              </td>
                              <td className="p-4 align-top hidden md:table-cell text-slate-600">
                                {video.type === 'shorts' ? 'Shorts' : 'Video'}
                              </td>
                              <td className="p-4 align-top hidden lg:table-cell text-slate-600">
                                {video.year}
                              </td>
                              <td className="p-4 align-top">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEdit(video)}
                                    className="text-slate-500 hover:text-primary transition-colors"
                                  >
                                    <span className="material-symbols-outlined">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(video.id)}
                                    className="text-slate-500 hover:text-red-500 transition-colors"
                                  >
                                    <span className="material-symbols-outlined">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
