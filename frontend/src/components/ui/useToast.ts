import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  durationMs?: number;
  undoAction?: () => Promise<void> | void;
  undoLabel?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  undoAction?: () => Promise<void> | void;
  undoLabel: string;
}

export interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
