import { getAdminAccess, AdminGate } from "@/lib/auth/adminAccess";
import ImportClient from "./ImportClient";

/**
 * Server gate for the bulk-import tool. The importer itself is a client
 * component, so the authorisation check has to live in this server
 * wrapper — the proxy guard is mirrored here so the page enforces access
 * even if middleware semantics change.
 */
export default async function IngestionImportPage() {
  const access = await getAdminAccess();
  if (!access.ok) {
    return <AdminGate reason={access.reason} redirectTo="/admin/ingestion/import" />;
  }

  return <ImportClient />;
}
