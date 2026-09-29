import { redirect } from "next/navigation";

/**
 * The conflicts index and the former War Room were two competing surfaces
 * for the same data. They are consolidated into the Conflict Tracker.
 */
export default function ConflictsIndexPage() {
  redirect("/conflict-tracker");
}
