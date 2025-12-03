import { useEffect } from 'react';
import { Icon } from '@iconify/react';

const Modal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'alert', // 'alert' | 'confirm'
  confirmText = '확인',
  cancelText = '취소'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isError = title?.includes('실패') || message?.includes('실패');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isError
              ? 'bg-red-100 text-red-600'
              : type === 'confirm'
                ? 'bg-amber-100 text-amber-600'
                : 'bg-primary/10 text-primary'
          }`}>
            <Icon
              icon={
                isError
                  ? 'lucide:x-circle'
                  : type === 'confirm'
                    ? 'lucide:alert-triangle'
                    : 'lucide:check-circle'
              }
              className="text-2xl"
            />
          </div>

          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}

          <p className="text-gray-600">{message}</p>

          <div className="flex gap-3 w-full mt-2">
            {type === 'confirm' && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={() => {
                if (type === 'confirm' && onConfirm) {
                  onConfirm();
                }
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                isError
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : type === 'confirm'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
