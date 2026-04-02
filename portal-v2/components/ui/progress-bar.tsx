interface ProgressBarProps {
  completed: number;
  total: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ProgressBar({
  completed,
  total,
  size = "sm",
  showLabel = true,
}: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barHeight = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className="space-y-1">
      <div className={`w-full ${barHeight} rounded-full bg-surface-secondary overflow-hidden`}>
        <div
          className={`${barHeight} rounded-full bg-primary transition-all duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && total > 0 && (
        <p className="text-[10px] text-text-tertiary">
          {completed} of {total} milestone{total !== 1 ? "s" : ""}{" "}
          <span className="text-text-quaternary">· {pct}%</span>
        </p>
      )}
    </div>
  );
}
