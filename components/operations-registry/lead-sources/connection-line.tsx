export function ConnectionLine({
  leadSourceName,
  feedName,
}: {
  leadSourceName: string;
  feedName: string;
}) {
  return (
    <p className="text-sm text-navy">
      lands in: {leadSourceName} → {feedName}
    </p>
  );
}
