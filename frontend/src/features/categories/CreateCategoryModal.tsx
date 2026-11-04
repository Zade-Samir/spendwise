import React, { useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useCreateCategory } from './useCategories';
import { addPriorityCategoryId } from '../../lib/categoryPriority';
import { haptic } from '../../lib/haptics';
import { useToast } from '../../components/ui/useToast';
import { CategoryChild } from '../../types/categories';
import { Loader2 } from 'lucide-react';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newCategory: CategoryChild) => void;
  initialName?: string;
}

const PRESET_COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
  '#3B82F6', // Blue
  '#EC4899', // Pink
];

const PRESET_ICONS = [
  'tag',
  'coffee',
  'utensils',
  'shopping-bag',
  'dumbbell',
  'car',
  'zap',
  'film',
  'heart-pulse',
  'gift',
  'book',
  'receipt',
];

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialName = '',
}) => {
  const [name, setName] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState<string>(PRESET_COLORS[0] || '#6366F1');
  const [selectedIcon, setSelectedIcon] = useState('tag');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateCategory();
  const { showToast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError(null);
    }
  }, [isOpen, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter a category name');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        name: cleanName,
        icon: selectedIcon,
        color: selectedColor,
      });

      // Prioritize at index 0 so it stays at the front for all future transactions
      addPriorityCategoryId(created.id);
      haptic.trigger('success');
      showToast(`Category "${created.name}" created!`, { type: 'success' });
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      haptic.trigger('warning');
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Create Custom Category"
      description="New category will appear at the front of your quick-add screen"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-500">
            {error}
          </div>
        )}

        {/* Live Preview Badge */}
        <div className="flex items-center justify-center py-2">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm transition-all"
            style={{
              backgroundColor: `${selectedColor}15`,
              borderColor: `${selectedColor}40`,
              color: selectedColor,
            }}
          >
            <CategoryIcon name={selectedIcon} className="w-5 h-5" />
            <span className="font-extrabold text-sm text-text">
              {name.trim() || 'Category Name'}
            </span>
          </div>
        </div>

        {/* Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text uppercase tracking-wider">
            Category Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Chai & Snacks, Gym, Gaming..."
            maxLength={50}
            autoFocus
            className="w-full px-3.5 py-3 rounded-xl bg-surface border border-surface-2 text-sm font-bold text-text placeholder:text-muted/60 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Color Palette */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text uppercase tracking-wider">
            Color Accent
          </label>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  setSelectedColor(c);
                }}
                className={`w-8 h-8 rounded-full flex-shrink-0 transition-transform ios-press flex items-center justify-center ${
                  selectedColor === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-background' : 'opacity-80'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Icon Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text uppercase tracking-wider">
            Icon
          </label>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_ICONS.map((iconName) => (
              <button
                key={iconName}
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  setSelectedIcon(iconName);
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-center ios-press transition-all ${
                  selectedIcon === iconName
                    ? 'border-primary bg-primary/10 text-primary shadow-xs scale-105'
                    : 'border-surface-2 bg-surface text-muted hover:text-text'
                }`}
              >
                <CategoryIcon name={iconName} className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary hover:bg-primary-dark ios-press text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Category...</span>
              </>
            ) : (
              <span>Create & Pin to Front</span>
            )}
          </button>
        </div>
      </form>
    </Sheet>
  );
};
