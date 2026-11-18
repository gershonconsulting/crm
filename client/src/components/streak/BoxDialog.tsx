import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ExternalLink, Mail, MessageSquare, Pencil, Plus, Settings2, Trash2, UserPlus, X } from "lucide-react";
import type { ActivityWithRelations, DealStage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  fieldValue,
  initials,
  patchBox,
  useDeals,
  useFields,
  useInvalidateBoxes,
  useStages,
  type PipelineField,
} from "@/lib/streak";
import FieldEditor from "./FieldEditor";
import FieldDialog from "./FieldDialog";
import { useToast } from "@/hooks/use-toast";

interface Props {
  dealId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Filter = "all" | "comments" | "updates";

const BoxDialog: React.FC<Props> = ({ dealId, open, onOpenChange }) => {
  const { data: allDeals = [] } = useDeals();
  const deal = allDeals.find((d) => d.id === dealId);
  const pipelineId = deal?.pipelineId ?? null;
  const { data: stages = [] } = useStages(pipelineId);
  const { data: fields = [] } = useFields(pipelineId);
  const invalidate = useInvalidateBoxes();
  const { toast } = useToast();

  const { data: activities = [] } = useQuery<ActivityWithRelations[]>({
    queryKey: ["/api/activities", dealId],
    enabled: !!dealId && open,
    queryFn: async () => {
      const r = await fetch(`/api/activities?dealId=${dealId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load timeline");
      return r.json();
    },
  });

  const [notes, setNotes] = useState("");
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [fieldDialog, setFieldDialog] = useState<{ open: boolean; field: PipelineField | null }>({ open: false, field: null });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    setNotes(deal?.notes || "");
    setNotesState("idle");
    setNameDraft(deal?.name || "");
    setComment("");
    // only when switching boxes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const team = useMemo(() => {
    const s = new Set<string>();
    for (const d of allDeals) for (const e of (d.assignedTo || "").split(/,\s*/)) if (e.trim()) s.add(e.trim());
    return Array.from(s).sort();
  }, [allDeals]);

  if (!deal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogTitle>Box not found</DialogTitle>
        </DialogContent>
      </Dialog>
    );
  }

  const stage = stages.find((s) => s.id === deal.stageId) || (deal as any).stage;
  const assignees = (deal.assignedTo || "").split(/,\s*/).filter(Boolean);
  const linked: { name: string; email?: string; title?: string; org?: string }[] =
    ((deal.linkedContacts as any[]) || []).length
      ? (deal.linkedContacts as any[])
      : deal.contact
        ? [{ name: deal.contact.name, email: deal.contact.email || undefined, title: deal.contact.position || undefined, org: deal.contact.company }]
        : [];
  const magic = (deal.magic as Record<string, any>) || {};

  const saveNotes = async () => {
    if (notes === (deal.notes || "")) return;
    setNotesState("saving");
    try {
      await patchBox(deal.id, { notes });
      invalidate(pipelineId);
      setNotesState("saved");
    } catch (e: any) {
      setNotesState("idle");
      toast({ title: "Notes not saved", description: e?.message, variant: "destructive" });
    }
  };

  const postComment = async () => {
    const m = comment.trim();
    if (!m) return;
    setPosting(true);
    try {
      await apiRequest("POST", `/api/deals/${deal.id}/comments`, { message: m });
      setComment("");
      invalidate(pipelineId, deal.id);
    } catch (e: any) {
      toast({ title: "Comment not saved", description: e?.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const changeStage = async (stageId: number) => {
    try {
      await patchBox(deal.id, { stageId });
      invalidate(pipelineId, deal.id);
    } catch (e: any) {
      toast({ title: "Stage not changed", description: e?.message, variant: "destructive" });
    }
  };

  const setAssignees = async (list: string[]) => {
    await patchBox(deal.id, { assignedTo: list.join(", ") });
    invalidate(pipelineId, deal.id);
  };

  const saveName = async () => {
    setEditingName(false);
    if (nameDraft.trim() && nameDraft.trim() !== deal.name) {
      await patchBox(deal.id, { name: nameDraft.trim() });
      invalidate(pipelineId, deal.id);
    }
  };

  const timeline = activities.filter((a) =>
    filter === "all" ? true : filter === "comments" ? a.type === "comment" : a.type !== "comment",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          {editingName ? (
            <Input
              autoFocus
              className="text-xl font-semibold h-10 max-w-lg"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
            />
          ) : (
            <DialogTitle
              className="text-xl font-semibold cursor-text hover:bg-gray-50 rounded px-1"
              onClick={() => setEditingName(true)}
              title="Click to rename"
            >
              {deal.name}
            </DialogTitle>
          )}
          {stage && (
            <span
              className="rounded-full px-3 py-0.5 text-sm font-medium"
              style={{ backgroundColor: stage.color, color: (stage as DealStage).textColor || "#fff" }}
            >
              {stage.name}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: notes + comments + timeline */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <section>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold">Notes</h3>
                <span className="text-xs text-gray-500">
                  {notesState === "saving" ? "Saving…" : notesState === "saved" ? "Saved ✓" : ""}
                </span>
              </div>
              <Textarea
                rows={5}
                placeholder="Notes about this box (saved automatically)"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesState("idle");
                }}
                onBlur={saveNotes}
              />
              {notes !== (deal.notes || "") && (
                <div className="flex justify-end mt-1">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={saveNotes}>
                    Save notes
                  </Button>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-1">Add a comment</h3>
              <Textarea
                rows={3}
                placeholder="Write a comment… (Ctrl+Enter to save)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) postComment();
                }}
              />
              <div className="flex justify-end mt-1">
                <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={postComment} disabled={posting || !comment.trim()}>
                  {posting ? "Saving…" : "Save"}
                </Button>
              </div>
            </section>

            <section>
              <div className="flex gap-1 border-b mb-3">
                {(["all", "comments", "updates"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    className={`px-3 py-1.5 text-sm capitalize border-b-2 -mb-px ${filter === f ? "border-red-600 font-medium" : "border-transparent text-gray-500"}`}
                    onClick={() => setFilter(f)}
                  >
                    {f} {f === "comments" ? `(${activities.filter((a) => a.type === "comment").length})` : ""}
                  </button>
                ))}
              </div>
              {timeline.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No activity yet</p>
              ) : (
                <ul className="space-y-3">
                  {timeline.map((a) => (
                    <TimelineItem key={a.id} a={a} onChanged={() => invalidate(pipelineId, deal.id)} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* RIGHT: stage, assignees, fields, contacts */}
          <aside className="w-[380px] border-l overflow-y-auto px-5 py-4 space-y-5 bg-gray-50/40">
            <section>
              <h3 className="text-sm font-semibold mb-1">Stage</h3>
              <div className="flex flex-wrap gap-1">
                {stages.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => changeStage(s.id)}
                    className={`rounded px-2 py-1 text-xs border ${s.id === deal.stageId ? "ring-2 ring-offset-1 ring-gray-800" : "opacity-80 hover:opacity-100"}`}
                    style={{ backgroundColor: s.color, color: s.textColor || "#fff" }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-1">Assigned to</h3>
              <AssigneePicker value={assignees} team={team} onChange={setAssignees} />
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Fields</h3>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setFieldDialog({ open: true, field: null })}>
                  <Plus className="h-3 w-3 mr-1" /> Add field
                </Button>
              </div>
              <div className="space-y-2">
                {fields.length === 0 && <p className="text-xs text-gray-500">No fields in this pipeline yet.</p>}
                {fields.map((f) => (
                  <div key={f.id}>
                    <div className="flex items-center justify-between group">
                      <label className="text-xs text-gray-500">{f.name}</label>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700"
                        title="Rename / delete field"
                        onClick={() => setFieldDialog({ open: true, field: f })}
                      >
                        <Settings2 className="h-3 w-3" />
                      </button>
                    </div>
                    <FieldEditor dealId={deal.id} field={f} value={fieldValue(deal, f)} />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Contacts and organizations</h3>
              {linked.length === 0 && <p className="text-xs text-gray-500">No contacts</p>}
              <ul className="space-y-2">
                {linked.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 bg-white border rounded p-2">
                    <span className="h-8 w-8 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center shrink-0">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {(c.title || c.org) && (
                        <p className="text-xs text-gray-500 truncate">{[c.title, c.org].filter(Boolean).join(" · ")}</p>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {Object.keys(magic).length > 0 && (
              <section className="text-xs text-gray-600 space-y-0.5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Activity (from Streak)</h3>
                {magic.lastEmailTimestamp && <p>Last email: {fmt(magic.lastEmailTimestamp)}</p>}
                {magic.totalNumberOfEmails !== undefined && <p>Emails: {magic.totalNumberOfEmails}</p>}
                {magic.totalNumberOfSentEmails !== undefined && <p>Sent emails: {magic.totalNumberOfSentEmails}</p>}
                {magic.soonestTaskDueDate && <p>Next task due: {fmt(magic.soonestTaskDueDate)}</p>}
                {magic.lastStageChangeTimestamp && <p>Stage changed: {fmt(magic.lastStageChangeTimestamp)}</p>}
                {magic.url && (
                  <a href={magic.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                    Open in Streak <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </section>
            )}
          </aside>
        </div>

        {pipelineId && (
          <FieldDialog
            pipelineId={pipelineId}
            field={fieldDialog.field}
            open={fieldDialog.open}
            onOpenChange={(o) => setFieldDialog((s) => ({ ...s, open: o }))}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

function fmt(v: any) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : format(d, "MMM d, yyyy");
}

const TimelineItem: React.FC<{ a: ActivityWithRelations; onChanged: () => void }> = ({ a, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.description);
  const isComment = a.type === "comment";
  const save = async () => {
    await apiRequest("PUT", `/api/activities/${a.id}`, { description: draft });
    setEditing(false);
    onChanged();
  };
  const del = async () => {
    if (!window.confirm("Delete this comment?")) return;
    await apiRequest("DELETE", `/api/activities/${a.id}`);
    onChanged();
  };
  if (!isComment) {
    return (
      <li className="flex items-start gap-2 text-xs text-gray-500">
        <Pencil className="h-3 w-3 mt-0.5 shrink-0" />
        <span className="flex-1">
          {a.createdBy && <b className="text-gray-700">{a.createdBy}</b>} {a.description}
        </span>
        <span className="shrink-0">{fmt(a.createdAt)}</span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-3 bg-white border rounded p-3 group">
      <span className="h-8 w-8 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shrink-0">
        {initials(a.createdBy || "?")}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <MessageSquare className="h-3 w-3" />
          <b className="text-gray-800">{a.createdBy || "Someone"}</b>
          <span>{format(new Date(a.createdAt), "MMM d, yyyy h:mm a")}</span>
          <span className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
            <button title="Edit" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
            </button>
            <button title="Delete" onClick={del}>
              <Trash2 className="h-3 w-3 text-red-600" />
            </button>
          </span>
        </div>
        {editing ? (
          <div className="mt-1">
            <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex justify-end gap-1 mt-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={save}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap mt-1 break-words">{a.description}</p>
        )}
      </div>
    </li>
  );
};

const AssigneePicker: React.FC<{ value: string[]; team: string[]; onChange: (v: string[]) => void }> = ({ value, team, onChange }) => {
  const [q, setQ] = useState("");
  const all = Array.from(new Set([...team, ...value]));
  const filtered = all.filter((e) => e.toLowerCase().includes(q.toLowerCase()));
  const toggle = (e: string) => onChange(value.includes(e) ? value.filter((x) => x !== e) : [...value, e]);
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {value.map((e) => (
        <span key={e} className="inline-flex items-center gap-1 bg-white border rounded-full pl-1 pr-2 py-0.5 text-xs">
          <span className="h-5 w-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">{initials(e)}</span>
          {e}
          <button onClick={() => toggle(e)}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2">
            <UserPlus className="h-3 w-3 mr-1" /> Assign
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <Input
            className="h-8 text-sm mb-2"
            placeholder="Search or type an email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && /@/.test(q) && !value.includes(q.trim())) {
                onChange([...value, q.trim()]);
                setQ("");
              }
            }}
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((e) => (
              <button key={e} className="w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 text-left" onClick={() => toggle(e)}>
                <span className="w-4">{value.includes(e) && <Check className="h-4 w-4 text-red-600" />}</span>
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default BoxDialog;
