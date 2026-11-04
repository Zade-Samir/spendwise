import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useInsights } from './useInsights';
import { InsightCard } from './InsightCard';

export const InsightsCarousel: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useInsights();

  const items = data?.items || [];

  if (isLoading) {
    return (
      <div className="bg-surface rounded-2xl p-4 border border-surface-2 animate-pulse h-28" />
    );
  }

  // Graceful degradation when no insights generated yet
  if (items.length === 0) {
    return null;
  }

  const displayItems = items.slice(0, 3);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-text">Spending Insights</h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/analytics')}
          className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
        >
          <span>See all ({items.length})</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Swipeable Carousel */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory -mx-4 px-4">
        {displayItems.map((insight) => (
          <div
            key={insight.id}
            className="min-w-[280px] max-w-[300px] flex-shrink-0 snap-start"
          >
            <InsightCard insight={insight} />
          </div>
        ))}
      </div>
    </section>
  );
};
