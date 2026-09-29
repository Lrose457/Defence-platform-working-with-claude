"use client";

import { useState } from "react";
import Link from "next/link";

type WatchItem = {
  entityType: string;
  entityId: number;
  entityName: string;
};

type Change = {
  id: number;
  entity_type: string;
  entity_id: number;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_type: string | null;
  changed_at: string | null;
  importance: string | null;
};

const STORAGE_KEY = "defence-intelligence-watchlist";

function entityHref(type: string, id: number) {
  const routes: Record<string, string> = {
    country: `/countries/${id}`,
    programme: `/programmes/${id}`,
    equipment: `/equipment/${id}`,
    company: `/companies/${id}`,
    contract: `/contracts/${id}`,
  };

  return routes[type] || "#";
}

function formatDate(value: string | null) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function WatchedActivity({
  changes,
}: {
  changes: Change[];
}) {
  const [watchlist] = useState<WatchItem[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      return stored ? JSON.parse(stored) as WatchItem[] : [];
    } catch {
      return [];
    }
  });

  const activity = changes
    .filter((change) =>
      watchlist.some(
        (item) =>
          item.entityType === change.entity_type &&
          item.entityId === change.entity_id
      )
    )
    .slice(0, 8);

  if (watchlist.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-(--border) bg-(--surface)">
      <div className="border-b border-(--border) px-5 py-4">
        <h2 className="text-sm font-semibold">
          Watched Activity
        </h2>

        <p className="mt-1 text-xs text-(--foreground-muted)">
          Recent changes involving entities you are watching.
        </p>
      </div>

      {activity.length === 0 ? (
        <div className="p-5">
          <p className="text-xs text-(--foreground-muted)">
            No recent changes to your watched entities.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-(--border)">
          {activity.map((change) => {
            const watched = watchlist.find(
              (item) =>
                item.entityType ===
                  change.entity_type &&
                item.entityId ===
                  change.entity_id
            );

            return (
              <Link
                key={change.id}
                href={entityHref(
                  change.entity_type,
                  change.entity_id
                )}
                className="block px-5 py-4 transition hover:bg-(--surface-hover)"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {watched?.entityName ||
                        "Watched entity"}
                    </p>

                    <p className="mt-1 text-xs text-(--foreground-muted)">
                      {change.field_name
                        ? change.field_name.replace(
                            /_/g,
                            " "
                          )
                        : change.change_type ||
                          "Updated"}
                    </p>

                    {change.old_value &&
                      change.new_value && (
                        <p className="mt-2 text-xs">
                          {change.old_value}{" "}
                          <span className="text-blue-400">
                            →
                          </span>{" "}
                          {change.new_value}
                        </p>
                      )}
                  </div>

                  <div className="shrink-0 text-right">
                    {change.importance === "high" && (
                      <span className="block text-[10px] font-semibold uppercase text-blue-400">
                        Important
                      </span>
                    )}

                    <span className="mt-1 block text-[10px] text-(--foreground-muted)">
                      {formatDate(change.changed_at)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}