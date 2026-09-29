import { redirect } from "next/navigation";

/** The War Room was renamed to the Conflict Tracker (patch 0.2). */
export default function WarRoomPage() {
  redirect("/conflict-tracker");
}
