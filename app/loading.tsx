export default function Loading() {
  return (
    <div
      className="intel-surface p-8"
      role="status"
      aria-live="polite"
    >
      <p className="font-medium text-slate-100">
        Loading intelligence changes…
      </p>

      <p className="mt-2 text-sm text-slate-500">
        Preparing the latest available intelligence.
      </p>
    </div>
  );
}