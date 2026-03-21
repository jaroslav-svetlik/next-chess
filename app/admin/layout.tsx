import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="content-wrap admin-page">
      <AdminShell>{children}</AdminShell>
    </main>
  );
}
