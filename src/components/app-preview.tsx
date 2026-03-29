import type { AppSpec, WebArtifact } from "@/lib/types";

export function AppPreview({
  spec,
  artifact,
  reloadKey = 0,
}: {
  spec: AppSpec | null;
  artifact: WebArtifact | null;
  reloadKey?: number;
}) {
  if (spec == null || artifact == null) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#090a0d] p-10 text-center">
        <div className="max-w-md space-y-3">
          <div className="text-xs font-semibold tracking-[0.26em] text-white/32">
            结果画布
          </div>
          <h2 className="text-3xl font-semibold text-white">
            生成完成后，这里会展示网页预览
          </h2>
          <p className="text-sm leading-7 text-white/48">
            左侧会话持续推进执行过程，右侧始终承接最终产物。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <iframe
        key={reloadKey}
        className="min-h-0 flex-1 w-full bg-white"
        sandbox="allow-scripts"
        srcDoc={artifact.document}
        title={spec.projectTitle}
      />
    </div>
  );
}
