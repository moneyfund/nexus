import { notFound } from "next/navigation";
export default async function PreviewQA({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; width?: string }>;
}) {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  const params = await searchParams;
  const width = Math.max(320, Math.min(1440, Number(params.width) || 390));
  const path =
    params.path?.startsWith("/") &&
    !params.path.startsWith("//") &&
    !params.path.startsWith("/qa-preview")
      ? params.path
      : "/";
  return (
    <div className="qa-only">
      <style>{`.app-rail,.topbar,.mobile-nav,.system-footer{display:none!important}.app-content{margin:0}.main-content{padding:20px}.qa-only{display:grid;justify-content:center;gap:14px}.qa-only iframe{border:1px solid #332039;border-radius:16px;background:#020203}`}</style>
      <p>
        Preview QA · {width}px · {path}
      </p>
      <iframe
        title="NEXUS mobile preview"
        src={path}
        width={width}
        height={844}
      />
    </div>
  );
}
