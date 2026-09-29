import { NextResponse } from "next/server";

import {
  getCredentialedIntelligenceSources,
  getLiveIntelligenceSources,
  intelligenceSources,
} from "@/lib/sourceRegistry";

export function GET() {
  return NextResponse.json({
    sources: intelligenceSources,
    liveSources: getLiveIntelligenceSources().map((source) => source.id),
    credentialedSources: getCredentialedIntelligenceSources().map((source) => ({
      id: source.id,
      name: source.name,
      access: source.access,
      requiresCredentials: source.requiresCredentials,
      credentialEnvVars: source.credentialEnvVars ?? [],
      adapterStatus: source.adapterStatus ?? "manual-review",
    })),
    generatedAt: new Date().toISOString(),
  });
}