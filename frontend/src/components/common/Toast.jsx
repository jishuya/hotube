import { useEffect } from 'react';
import { Icon } from '@iconify/react';

const toastConfig = {
  success: {
    icon: 'lucide:check-circle',
    bg: 'bg-green-50 border-green-200',
    iconColor: 'text-green-600',
    textColor: 'text-green-800'
  },
  error: {
    icon: 'lucide:x-circle',
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
    textColor: 'text-red-800'
  },
  warning: {
    icon: 'lucide:alert-triangle',
    bg: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-800'
  },
  info: {
    icon: 'lucide:info',
    bg: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-800'
  }
};

const ToastItem = ({ toast, onRemove }) => {
  const config = toastConfig[toast.type] || toastConfig.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${config.bg} animate-in slide-in-from-right fade-in duration-300`}
    >
      <Icon icon={config.icon} className={`text-xl ${config.iconColor} shrink-0`} />
      <p className={`text-sm font-medium ${config.textColor}`}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className={`ml-auto ${config.iconColor} hover:opacity-70 transition-opacity`}
      >
        <Icon icon="lucide:x" className="text-lg" />
      </button>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;
