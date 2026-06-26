import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import clsx from 'clsx';

type ToastVariant = 'success' | 'error' | 'info';
interface ToastMessage {
  id: string;
  title: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  push: (title: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const push = useCallback((title: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    setToasts((prev) => [...prev, { id, title, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'px-4 py-3 rounded-lg text-sm text-white',
              toast.variant === 'success' && 'bg-green-600',
              toast.variant === 'error' && 'bg-red-600',
              toast.variant === 'info' && 'bg-blue-600'
            )}
          >
            {toast.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
