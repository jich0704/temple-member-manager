import type { LucideIcon } from 'lucide-react';
import { Card } from './ui/card';

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
}

export default function StatsCard({ title, value, icon: Icon, gradient, iconColor }: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <h3 className="text-3xl font-bold tracking-tight">{value.toLocaleString()}</h3>
          </div>
          <div className={`p-3 rounded-xl ${gradient}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>
      </div>
      <div className={`absolute -bottom-2 -right-2 w-24 h-24 ${gradient} opacity-10 rounded-full blur-2xl`} />
    </Card>
  );
}
