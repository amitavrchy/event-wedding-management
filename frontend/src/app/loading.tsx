export default function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Loading page" role="status">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <span className="sr-only">Loading your next beautiful moment</span>
    </div>
  );
}
