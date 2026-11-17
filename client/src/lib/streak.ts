import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DealStage, DealWithContact, FieldOption, Pipeline, PipelineField } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export type { FieldOption, Pipeline, PipelineField };
export type PipelineWithCount = Pipeline & { boxCount: number };

export const PIPELINE_STORAGE_KEY = "crm.pipelineId";

export function usePipelines() {
  return useQuery<PipelineWithCount[]>({ queryKey: ["/api/pipelines"] });
}

export function useStages(pipelineId?: number | null) {
  return useQuery<DealStage[]>({
    queryKey: [`/api/pipelines/${pipelineId}/stages`],
    enabled: !!pipelineId,
  });
}

export function useFields(pipelineId?: number | null) {
  return useQuery<PipelineField[]>({
    queryKey: [`/api/pipelines/${pipelineId}/fields`],
    enabled: !!pipelineId,
  });
}

export function useDeals() {
  return useQuery<DealWithContact[]>({ queryKey: ["/api/deals"] });
}

export function useMe() {
  return useQuery<{ username: string }>({ queryKey: ["/api/me"] });
}

/** Pick the pipeline to show: last one used, else "GC Pipeline", else the first. */
export function pickDefaultPipeline(list: PipelineWithCount[] = []): PipelineWithCount | undefined {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(PIPELINE_STORAGE_KEY);
  } catch {}
  return (
    list.find((p) => String(p.id) === saved) ||
    list.find((p) => p.name === "GC Pipeline") ||
    list[0]
  );
}

export function rememberPipeline(id: number) {
  try {
    localStorage.setItem(PIPELINE_STORAGE_KEY, String(id));
  } catch {}
}

export function fieldValue(deal: { customFields?: unknown }, field: PipelineField): any {
  const cf = (deal.customFields as Record<string, any>) || {};
  return cf[String(field.id)];
}

export function optionsOf(field: PipelineField): FieldOption[] {
  return ((field.options as FieldOption[]) || []).filter(Boolean);
}

export function displayFieldValue(field: PipelineField, value: any): string {
  if (value === null || value === undefined || value === "") return "";
  const opts = optionsOf(field);
  switch (field.type) {
    case "DROPDOWN":
      return opts.find((o) => o.key === value)?.name ?? String(value);
    case "TAG":
      return (Array.isArray(value) ? value : [value]).map((k) => opts.find((o) => o.key === k)?.name ?? k).join(", ");
    case "CHECKBOX":
      return value ? "✓" : "";
    case "DATE": {
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    default:
      return String(value);
  }
}

/** Streak-like soft colors for dropdown chips when an option has no color of its own. */
const CHIP_COLORS = ["#E3F2FD", "#E8F5E9", "#FFF3E0", "#F3E5F5", "#E0F7FA", "#FCE4EC", "#F1F8E9", "#EDE7F6", "#FFFDE7", "#ECEFF1"];
export function chipColor(option?: FieldOption): string {
  if (!option) return "#ECEFF1";
  if (option.color) return option.color;
  let h = 0;
  for (const c of option.key + option.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

export function isUrl(v: string) {
  return /^https?:\/\//i.test(v) || /^www\./i.test(v);
}

export function useInvalidateBoxes() {
  const qc = useQueryClient();
  return (pipelineId?: number | null, dealId?: number) => {
    qc.invalidateQueries({ queryKey: ["/api/deals"] });
    if (pipelineId) qc.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}/fields`] });
    if (dealId) qc.invalidateQueries({ queryKey: ["/api/activities", dealId] });
    qc.invalidateQueries({ queryKey: ["/api/pipelines"] });
  };
}

export async function setBoxField(dealId: number, fieldId: number, value: any) {
  return apiRequest("PATCH", `/api/deals/${dealId}/field`, { fieldId, value });
}

export async function patchBox(dealId: number, patch: Record<string, any>) {
  return apiRequest("PATCH", `/api/deals/${dealId}`, patch);
}

export const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  DROPDOWN: "Dropdown",
  TAG: "Tags",
  CHECKBOX: "Checkbox",
  DATE: "Date",
  NUMBER: "Number",
};

export function initials(name?: string | null) {
  const s = (name || "?").trim();
  const parts = s.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}
