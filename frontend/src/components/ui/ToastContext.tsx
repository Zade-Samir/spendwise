import React, { useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastContext, ToastMessage, ToastOptions } from './useToast';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const dismissToast = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = Math.random().toString(36).substring(2, 9);
      const toast: ToastMessage = {
        id,
        message,
        type: options?.type || 'success',
        undoAction: options?.undoAction,
        undoLabel: options?.undoLabel || 'UNDO',
      };

      setToasts((prev) => [...prev, toast]);

      const duration = options?.durationMs ?? 5000;
      timersRef.current[id] = setTimeout(() => {
        dismissToast(id);
      }, duration);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {/* Floating toast container above bottom TabBar */}
      <div
        aria-live="polite"
        className="fixed bottom-16 left-0 right-0 z-50 pointer-events-none flex flex-col items-center px-4 space-y-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-center justify-between w-full max-w-sm px-4 py-3 rounded-2xl bg-surface/95 dark:bg-surface/95 backdrop-blur-md border border-surface-2 shadow-lg text-text animate-in slide-in-from-bottom-2 duration-200"
          >
            <div className="flex items-center space-x-2.5 min-w-0 mr-2">
              {toast.type === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
              )}
              {toast.type === 'error' && (
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
              )}
              {toast.type === 'info' && (
                <Info className="w-5 h-5 text-primary flex-shrink-0" />
              )}
              <span className="text-xs font-medium truncate">{toast.message}</span>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              {toast.undoAction && (
                <button
                  type="button"
                  onClick={async () => {
                    const action = toast.undoAction;
                    dismissToast(toast.id);
                    if (action) await action();
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg tracking-wider transition-colors"
                >
                  {toast.undoLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-muted hover:text-text p-1"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
