import { KnowledgeView } from "@/components/modules/knowledge";
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  return <KnowledgeView key={item ?? "all"} initialItemId={item} />;
}
