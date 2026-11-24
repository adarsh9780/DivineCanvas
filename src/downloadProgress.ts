export function transferFraction(bytesWritten: number, reportedTotal: number, expectedTotal: number) {
  const total = reportedTotal > 0 ? reportedTotal : expectedTotal;
  return total > 0 ? Math.max(0, Math.min(1, bytesWritten / total)) : 0;
}

export function downloadProgressLabel(progress: number, hindi: boolean) {
  if (progress <= 0) return hindi ? 'तैयार हो रहा है…' : 'Preparing…';
  if (progress >= 1) return hindi ? 'डाउनलोड जाँचा जा रहा है…' : 'Verifying…';
  return `${Math.min(99, Math.floor(progress * 100))}%`;
}
