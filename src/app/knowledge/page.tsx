import { Suspense } from "react";
import { KnowledgeRoute } from "@/components/knowledge-route";

export default function KnowledgePage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeRoute />
    </Suspense>
  );
}
