import React from 'react';

interface MilestonePlaceholderProps {
  title: string;
  milestone: string;
  description: string;
}

export const MilestonePlaceholder: React.FC<MilestonePlaceholderProps> = ({
  title,
  milestone,
  description,
}) => {
  return (
    <div className="bg-surface rounded-2xl p-6 border border-surface-2 text-center space-y-3 mt-8">
      <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
        {milestone}
      </div>
      <h2 className="text-lg font-bold text-text">{title}</h2>
      <p className="text-sm text-muted max-w-xs mx-auto">{description}</p>
    </div>
  );
};
