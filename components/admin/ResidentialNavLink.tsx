import Link from "next/link";

export default function ResidentialNavLink() {
  return (
    <Link
      href="/admin/residential-dashboard"
      style={{
        display: "block",
        margin: "0 12px 12px",
        padding: "10px 12px",
        borderRadius: "6px",
        background: "linear-gradient(90deg, #e56700, #ff8c2a)",
        color: "#ffffff",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      Residential Dashboard
    </Link>
  );
}
