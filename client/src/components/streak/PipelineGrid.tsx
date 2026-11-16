import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Plus, Search, Settings2, ArrowUp, ArrowDown } from "lucide-react";
import type { DealWithContact } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  displayFieldValue,
  fieldValue,
  initials,
  patchBox,
  pickDefaultPipeline,
  rememberPipeline,
  useDeals,
  useFields,
  useInvalidateBoxes,
  usePipelines,
  useStages,
  type PipelineField,
} from "@/lib/streak";
import FieldEditor from "./FieldEditor";
import FieldDialog from "./FieldDialog";
import EditOptionsDialog from "./EditOptionsDialog";
import BoxDialog from "./BoxDialog";
import { useToast } from "@/hooks/use-toast";

const PAGE = 150;

type SortKey = { col: string; dir: 1 | -1 } | null;

/** Streak-style pipeline: stage funnel on top, spreadsheet grouped by stage, every field editable in place. */
const PipelineGrid: React.FC = () => {
  const { data: pipelines = [] } = usePipelines();
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  useEffect(() => {
    if (!pipelineId && pipelines.length) setPipelineId(pickDefaultPipeline(pipelines)?.id ?? null);
  }, [pipelines, pipelineId]);

  const { data: stages = [] } = useStages(pipelineId);
  const { data: fields = [] } = useFields(pipelineId);
  const { data: allDeals = [], isLoading } = useDeals();
  const invalidate = useInvalidateBoxes();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [shown, setShown] = useState<Record<number, number>>({});
  const [sort, setSort] = useState<SortKey>(null);
  const [openBox, setOpenBox] = useState<number | null>(null);
  const [fieldDialog, setFieldDialog] = useState<{ open: boolean; field: PipelineField | null }>({ open: false, field: null });
  const [optionsField, setOptionsField] = useState<PipelineField | null>(null);
  const [newBox, setNewBox] = useState<{ stageId: number; name: string } | null>(null);

  const deals = useMemo(() => allDeals.filter((d) => d.pipelineId === pipelineId), [allDeals, pipelineId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = deals;
    if (needle) {
      list = list.filter((d) => {
        const hay = [
          d.name,
          d.notes,
          d.assignedTo,
          d.contact?.name,
          d.contact?.email,
          ...((d.linkedContacts as any[]) || []).map((c) => `${c.name} ${c.email || ""} ${c.org || ""}`),
          ...fields.map((f) => displayFieldValue(f, fieldValue(d, f))),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    if (sort) {
      const val = (d: DealWithContact): string => {
        if (sort.col === "name") return d.name.toLowerCase();
        if (sort.col === "assigned") return (d.assignedTo || "").toLowerCase();
        if (sort.col === "updated") return new Date((d as any).updatedAt || d.createdAt).toISOString();
        if (sort.col === "notes") return (d.notes || "").toLowerCase();
        const f = fields.find((x) => String(x.id) === sort.col);
        return f ? displayFieldValue(f, fieldValue(d, f)).toLowerCase() : "";
      };
      list = [...list].sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        if (!va && vb) return 1;
        if (va && !vb) return -1;
        return va < vb ? -sort.dir : va > vb ? sort.dir : 0;
      });
    }
    return list;
  }, [deals, q, sort, fields]);

  const byStage = useMemo(() => {
    const m = new Map<number, DealWithContact[]>();
    for (const s of stages) m.set(s.id, []);
    for (const d of filtered) m.get(d.stageId)?.push(d);
    return m;
  }, [filtered, stages]);

  const pipeline = pipelines.find((p) => p.id === pipelineId);

  const switchPipeline = (id: number) => {
    setPipelineId(id);
    rememberPipeline(id);
    setStageFilter(null);
    setSort(null);
  };

  const toggleSort = (col: string) =>
    setSort((s) => (!s || s.col !== col ? { col, dir: 1 } : s.dir === 1 ? { col, dir: -1 } : null));

  const createBox = async () => {
    if (!newBox || !newBox.name.trim() || !pipelineId) return;
    try {
      const r = await apiRequest("POST", `/api/pipelines/${pipelineId}/boxes`, { name: newBox.name.trim(), stageId: newBox.stageId });
      const row = await r.json();
      setNewBox(null);
      invalidate(pipelineId);
      setOpenBox(row.id);
    } catch (e: any) {
      toast({ title: "Box not created", description: e?.message, variant: "destructive" });
    }
  };

  const changeStage = async (dealId: number, stageId: number) => {
    await patchBox(dealId, { stageId });
    invalidate(pipelineId, dealId);
  };

  const SortIcon = ({ col }: { col: string }) =>
    sort?.col === col ? sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null;

  const colW = (f: PipelineField) => (f.type === "CHECKBOX" ? 70 : f.type === "TAG" ? 220 : f.type === "DATE" ? 130 : 170);

  return (
    <div className="mt-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <select
          className="h-10 border rounded px-3 text-lg font-medium bg-white"
          value={pipelineId ?? ""}
          onChange={(e) => switchPipeline(Number(e.target.value))}
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-600">{deals.length} Boxes</span>
        <div className="relative ml-auto">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
          <Input className="pl-8 h-9 w-64" placeholder="Search boxes, contacts, fields…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setFieldDialog({ open: true, field: null })} disabled={!pipelineId}>
          <Plus className="h-4 w-4 mr-1" /> Add field
        </Button>
        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => stages[0] && setNewBox({ stageId: stageFilter || stages[0].id, name: "" })} disabled={!stages.length}>
          <Plus className="h-4 w-4 mr-1" /> New box
        </Button>
      </div>

      {/* Stage funnel (click to filter) */}
      <div className="flex w-full rounded-lg overflow-hidden mb-4">
        {stages.map((s, i) => {
          const n = deals.filter((d) => d.stageId === s.id).length;
          const active = stageFilter === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setStageFilter(active ? null : s.id)}
              className={`flex-1 min-w-0 text-left px-4 py-2 relative ${stageFilter && !active ? "opacity-50" : ""}`}
              style={{
                backgroundColor: s.color,
                color: s.textColor || "#fff",
                clipPath: i === stages.length - 1 ? undefined : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
                marginRight: i === stages.length - 1 ? 0 : -10,
                paddingLeft: i === 0 ? 16 : 22,
              }}
              title={s.name}
            >
              <div className="text-xl font-bold leading-tight">{n}</div>
              <div className="text-sm truncate">{s.name}</div>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="text-gray-500 py-8 text-center">Loading…</p>
      ) : (
        <div className="border rounded-md overflow-auto max-h-[calc(100vh-260px)] bg-white">
          <table className="text-xs border-collapse min-w-full">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-50 border-b border-r text-left font-medium text-gray-600 px-3 py-2 min-w-[240px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                    Name <SortIcon col="name" />
                  </button>
                </th>
                <th className="border-b border-r text-left font-medium text-gray-600 px-2 py-2 min-w-[130px]">Stage</th>
                <th className="border-b border-r text-left font-medium text-gray-600 px-2 py-2 min-w-[150px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("assigned")}>
                    Assigned To <SortIcon col="assigned" />
                  </button>
                </th>
                <th className="border-b border-r text-left font-medium text-gray-600 px-2 py-2 min-w-[220px]">Contacts and organizations</th>
                <th className="border-b border-r text-left font-medium text-gray-600 px-2 py-2 min-w-[220px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("notes")}>
                    Notes <SortIcon col="notes" />
                  </button>
                </th>
                {fields.map((f) => (
                  <th key={f.id} className="border-b border-r text-left font-medium text-gray-600 px-2 py-2 group" style={{ minWidth: colW(f) }}>
                    <div className="flex items-center gap-1">
                      <button className="flex items-center gap-1 truncate" onClick={() => toggleSort(String(f.id))}>
                        {f.name} <SortIcon col={String(f.id)} />
                      </button>
                      <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
                        {(f.type === "DROPDOWN" || f.type === "TAG") && (
                          <button title="Edit options" className="underline text-[10px]" onClick={() => setOptionsField(f)}>
                            options
                          </button>
                        )}
                        <button title="Rename / delete field" onClick={() => setFieldDialog({ open: true, field: f })}>
                          <Settings2 className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  </th>
                ))}
                <th className="border-b text-left font-medium text-gray-600 px-2 py-2 min-w-[110px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("updated")}>
                    Last updated <SortIcon col="updated" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {stages
                .filter((s) => !stageFilter || s.id === stageFilter)
                .map((s) => {
                  const rows = byStage.get(s.id) || [];
                  const isCollapsed = collapsed[s.id];
                  const limit = shown[s.id] || PAGE;
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="bg-gray-100">
                        <td className="sticky left-0 z-10 bg-gray-100 border-b px-2 py-1.5" colSpan={1}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))}>
                              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <span className="rounded px-2 py-0.5 text-sm font-medium" style={{ backgroundColor: s.color, color: s.textColor || "#fff" }}>
                              {s.name}
                            </span>
                            <span className="text-gray-500">{rows.length}</span>
                            <button title="New box in this stage" onClick={() => setNewBox({ stageId: s.id, name: "" })}>
                              <Plus className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        </td>
                        <td className="border-b bg-gray-100" colSpan={5 + fields.length} />
                      </tr>
                      {!isCollapsed &&
                        rows.slice(0, limit).map((d) => {
                          const linked = ((d.linkedContacts as any[]) || []).length
                            ? (d.linkedContacts as any[])
                            : d.contact && d.contact.name !== d.name
                              ? [{ name: d.contact.name }]
                              : [];
                          return (
                            <tr key={d.id} className="hover:bg-blue-50/40 cursor-pointer" onClick={() => setOpenBox(d.id)}>
                              <td className="sticky left-0 z-10 bg-white border-b border-r px-3 py-1 font-medium text-gray-900 max-w-[280px] truncate" title={d.name}>
                                {d.name}
                              </td>
                              <td className="border-b border-r px-1 py-1" onClick={(e) => e.stopPropagation()}>
                                <select
                                  className="text-xs bg-transparent w-full cursor-pointer"
                                  value={d.stageId}
                                  onChange={(e) => changeStage(d.id, Number(e.target.value))}
                                >
                                  {stages.map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {x.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="border-b border-r px-2 py-1">
                                <div className="flex gap-1">
                                  {(d.assignedTo || "")
                                    .split(/,\s*/)
                                    .filter(Boolean)
                                    .map((e) => (
                                      <span key={e} title={e} className="h-5 w-5 rounded-full bg-teal-600 text-white text-[9px] flex items-center justify-center">
                                        {initials(e)}
                                      </span>
                                    ))}
                                </div>
                              </td>
                              <td className="border-b border-r px-2 py-1 max-w-[260px]">
                                <div className="flex gap-2 overflow-hidden">
                                  {linked.slice(0, 3).map((c: any, i: number) => (
                                    <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap">
                                      <span className="h-5 w-5 rounded-full bg-teal-600 text-white text-[9px] flex items-center justify-center">{initials(c.name)}</span>
                                      {c.name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="border-b border-r px-2 py-1 max-w-[260px] truncate text-gray-700" title={d.notes || ""}>
                                {d.notes}
                              </td>
                              {fields.map((f) => (
                                <td key={f.id} className="border-b border-r px-1 py-0.5 max-w-[260px]">
                                  <FieldEditor compact dealId={d.id} field={f} value={fieldValue(d, f)} />
                                </td>
                              ))}
                              <td className="border-b px-2 py-1 text-gray-500 whitespace-nowrap">
                                {format(new Date((d as any).updatedAt || d.createdAt), "MMM d, yyyy")}
                              </td>
                            </tr>
                          );
                        })}
                      {!isCollapsed && rows.length > limit && (
                        <tr>
                          <td className="sticky left-0 bg-white px-3 py-2 border-b" colSpan={1}>
                            <button className="text-blue-600 hover:underline" onClick={() => setShown((x) => ({ ...x, [s.id]: limit + PAGE }))}>
                              Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}
                            </button>
                          </td>
                          <td className="border-b" colSpan={5 + fields.length} />
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
          {pipeline && deals.length === 0 && <p className="text-center text-gray-500 py-10">No boxes in {pipeline.name} yet.</p>}
        </div>
      )}

      {newBox && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setNewBox(null)}>
          <div className="bg-white rounded-lg p-5 w-[420px] space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">New box</h3>
            <Input autoFocus placeholder="Box name (company)" value={newBox.name} onChange={(e) => setNewBox({ ...newBox, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && createBox()} />
            <select className="w-full h-9 border rounded px-2 text-sm" value={newBox.stageId} onChange={(e) => setNewBox({ ...newBox, stageId: Number(e.target.value) })}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewBox(null)}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={createBox} disabled={!newBox.name.trim()}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {pipelineId && (
        <FieldDialog pipelineId={pipelineId} field={fieldDialog.field} open={fieldDialog.open} onOpenChange={(o) => setFieldDialog((s) => ({ ...s, open: o }))} />
      )}
      {optionsField && <EditOptionsDialog field={optionsField} open={!!optionsField} onOpenChange={(o) => !o && setOptionsField(null)} />}
      <BoxDialog dealId={openBox} open={openBox !== null} onOpenChange={(o) => !o && setOpenBox(null)} />
    </div>
  );
};

export default PipelineGrid;
