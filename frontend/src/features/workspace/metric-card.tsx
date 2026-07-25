import { Card } from "@/components/ui/card";

export interface MetricCardProps {
  label: string;
  value: number;
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card
      role="group"
      aria-label={label}
      className="min-w-0 p-4 sm:p-5"
    >
      <p className="text-sm font-medium text-[var(--aios-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--aios-text)]">
        {value}
      </p>
    </Card>
  );
}
