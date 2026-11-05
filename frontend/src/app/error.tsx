"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <span className="brand">
        utsab<span>✳</span>
      </span>
      <h1>A small pause in the planning.</h1>
      <p>
        Something went wrong loading this page. Your saved plans are still in
        your workspace.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
