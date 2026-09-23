"use client";

import { useSearchParams } from "next/navigation";
import { KnowledgeView } from "@/components/modules/knowledge";

export function KnowledgeRoute() {
  const searchParams = useSearchParams();
  const item = searchParams.get("item") ?? undefined;
  return <KnowledgeView key={item ?? "all"} initialItemId={item} />;
}
