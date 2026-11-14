import Link from "next/link";

export default function Estate2NavLink() {
  return (
    <Link
      href="/admin/estate-2-dashboard"
      style={{
        display: "block",
        margin: "0 12px 12px",
        padding: "10px 12px",
        borderRadius: "6px",
        background: "#0c4484",
        color: "#ffffff",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      Estate 2 Dashboard
    </Link>
  );
}
