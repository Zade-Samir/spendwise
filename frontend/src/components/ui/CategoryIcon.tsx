import React from 'react';
import {
  Utensils,
  Coffee,
  ShoppingBag,
  Car,
  Home,
  Zap,
  Film,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Plane,
  Tag,
  Dumbbell,
  ShieldAlert,
  Smartphone,
  Gift,
  Tv,
  Wifi,
  Coins,
  Receipt,
  LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  utensils: Utensils,
  coffee: Coffee,
  'shopping-bag': ShoppingBag,
  shoppingbag: ShoppingBag,
  car: Car,
  home: Home,
  zap: Zap,
  film: Film,
  'heart-pulse': HeartPulse,
  heartpulse: HeartPulse,
  'graduation-cap': GraduationCap,
  graduationcap: GraduationCap,
  briefcase: Briefcase,
  plane: Plane,
  dumbbell: Dumbbell,
  'shield-alert': ShieldAlert,
  smartphone: Smartphone,
  gift: Gift,
  tv: Tv,
  wifi: Wifi,
  coins: Coins,
  receipt: Receipt,
};

interface CategoryIconProps extends LucideProps {
  name?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, ...props }) => {
  const normalized = (name || '').toLowerCase().trim();
  const IconComponent = ICON_MAP[normalized] || Tag;
  return <IconComponent {...props} />;
};
