import Link from "next/link";

export default function OmanaNavLink() {
  return (
    <Link
      href="/admin/omana-dashboard"
      style={{
        display: "block",
        margin: "0 12px 12px",
        padding: "10px 12px",
        borderRadius: "6px",
        background: "#711b75",
        color: "#ffffff",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      Omana Projects Dashboard
    </Link>
  );
}
