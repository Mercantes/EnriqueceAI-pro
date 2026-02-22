interface FitScoreBadgeProps {
  score: number;
}

export function FitScoreBadge({ score }: FitScoreBadgeProps) {
  const color =
    score >= 70
      ? 'bg-green-100 text-green-700'
      : score >= 40
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}
