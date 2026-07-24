const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const createSupportRequest = async ({ userId, requestType, message, files = [] }) => {
  const formData = new FormData();
  formData.append('userId', userId);
  formData.append('requestType', requestType);
  formData.append('message', message);
  files.forEach((file) => formData.append('files', file));

  const response = await fetch(`${API_BASE_URL}/createSupportRequest`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '문의를 접수하지 못했습니다');
  return result;
};

export const getSupportRequests = async (adminId) => {
  const response = await fetch(`${API_BASE_URL}/supportRequests?adminId=${encodeURIComponent(adminId)}`);
  const result = await response.json().catch(() => []);
  if (!response.ok) throw new Error(result.error || '알림을 불러오지 못했습니다');
  return result;
};

export const getSupportRequest = async (requestId, adminId) => {
  const response = await fetch(`${API_BASE_URL}/supportRequests/${encodeURIComponent(requestId)}?adminId=${encodeURIComponent(adminId)}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '접수 내용을 불러오지 못했습니다');
  return {
    ...result,
    attachments: (result.attachments || []).map((attachment) => ({
      ...attachment,
      url: `${API_BASE_URL}/supportRequests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachment.id)}?adminId=${encodeURIComponent(adminId)}`,
    })),
  };
};

export const markSupportRequestRead = async (requestId, adminId) => {
  const response = await fetch(`${API_BASE_URL}/supportRequests/${encodeURIComponent(requestId)}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '알림 상태를 변경하지 못했습니다');
  return result;
};

export const updateSupportRequestStatus = async (requestId, status, adminId) => {
  const response = await fetch(`${API_BASE_URL}/supportRequests/${encodeURIComponent(requestId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId, status }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '처리 상태를 변경하지 못했습니다');
  return result;
};
