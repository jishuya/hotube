export const getUploadFailureMessage = (error) => {
  if (error?.name === 'AbortError') return '업로드를 중지했어요.';
  const message = String(error?.message || '').toLowerCase();
  if (error?.code === 'UPLOAD_NETWORK_ERROR' || message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')) {
    return '통신문제로 중단되었습니다';
  }
  if (error?.code === 'UPLOAD_TIMEOUT') return '서버 응답이 지연됐어요.';
  if (message.includes('too large') || message.includes('파일이 너무 큽니다')) {
    return '파일 용량이 너무 커요.';
  }
  return error?.message || '업로드하지 못했습니다.';
};

export const getInterruptedUploadFeedback = ({ total, completed, reason, cancelled = false }) => ({
  title: completed > 0 ? '업로드 안내' : '업로드 중단',
  message: [
    `${total}개 중 ${completed}개 업로드`,
    cancelled ? '업로드를 중지했습니다' : reason || '업로드가 중단되었습니다',
    '남은 파일은 다시 시도해주세요',
  ].join('\n'),
});
