import React from 'react';

export const PageLoader: React.FC = () => {
  return (
    <div
      className="space-y-4 animate-pulse pt-2"
      role="status"
      aria-label="Loading page content"
    >
      <div className="h-7 w-40 bg-surface-2 rounded-xl" />
      <div className="h-36 bg-surface-2 rounded-2xl" />
      <div className="space-y-2.5 pt-2">
        <div className="h-16 bg-surface-2 rounded-2xl" />
        <div className="h-16 bg-surface-2 rounded-2xl" />
        <div className="h-16 bg-surface-2 rounded-2xl" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

