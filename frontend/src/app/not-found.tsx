import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <span className="brand">
        utsab<span>✳</span>
      </span>
      <span className="eyebrow">A LITTLE DETOUR</span>
      <h1>This moment is still to be found.</h1>
      <p>The page you’re looking for may have moved.</p>
      <Link className="button primary" href="/">
        Back to your celebration →
      </Link>
    </main>
  );
}
