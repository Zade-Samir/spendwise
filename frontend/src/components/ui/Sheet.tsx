import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { haptic } from '../../lib/haptics';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxHeight = 'max-h-[88vh]',
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset drag state whenever sheet opens
  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startYRef.current = touch.clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    const diff = touch.clientY - startYRef.current;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Dismiss if dragged down > 85px
    if (dragY > 85) {
      haptic.trigger('medium');
      onClose();
    } else {
      setDragY(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md mx-auto ios-glass rounded-t-[32px] border-t border-white/10 shadow-2xl flex flex-col ${maxHeight} overflow-hidden spring-in`}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle area with gesture listener */}
        <div
          className="w-full pt-3.5 pb-2 cursor-grab active:cursor-grabbing flex justify-center touch-none select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-surface-2 dark:bg-white/25 rounded-full" />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pb-3 border-b border-surface-2 dark:border-white/5 flex-shrink-0 select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div>
            <h2 className="text-lg font-extrabold text-text tracking-tight">{title}</h2>
            {description && (
              <p className="text-xs text-muted font-medium mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              haptic.trigger('light');
              onClose();
            }}
            className="ios-press p-2 rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );
};
