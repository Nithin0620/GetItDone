import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px" }}>
      <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>Page Not Found</h2>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="btn btn-primary" style={{ display: "inline-flex" }}>
        Return Home
      </Link>
    </div>
  );
}
