import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { chipColor, optionsOf, useInvalidateBoxes, type FieldOption, type PipelineField } from "@/lib/streak";
import { useToast } from "@/hooks/use-toast";

const PALETTE = ["", "#FFCDD2", "#FFE0B2", "#FFF9C4", "#C8E6C9", "#B2EBF2", "#BBDEFB", "#D1C4E9", "#F8BBD0", "#CFD8DC"];

interface Props {
  field: PipelineField;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Streak's "Edit options" for a dropdown / tag field: add, rename, recolor, reorder, delete. */
const EditOptionsDialog: React.FC<Props> = ({ field, open, onOpenChange }) => {
  const [rows, setRows] = useState<FieldOption[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateBoxes();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setRows(optionsOf(field).map((o) => ({ ...o })));
      setNewName("");
    }
  }, [open, field]);

  const update = (i: number, patch: Partial<FieldOption>) =>
    setRows((r) => r.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const c = [...r];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const add = () => {
    const n = newName.trim();
    if (!n) return;
    setRows((r) => [...r, { key: "", name: n }]);
    setNewName("");
  };
  const sortAZ = () => setRows((r) => [...r].sort((a, b) => a.name.trim().localeCompare(b.name.trim())));

  const save = async () => {
    const pending = newName.trim();
    const finalRows = pending ? [...rows, { key: "", name: pending }] : rows;
    const removed = optionsOf(field).filter((o) => !finalRows.some((r) => r.key === o.key));
    if (removed.length && !window.confirm(`Delete ${removed.length} option(s): ${removed.map((o) => o.name).join(", ")}?\nBoxes using them will be cleared for this field.`)) return;
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/fields/${field.id}`, { options: finalRows });
      invalidate(field.pipelineId);
      toast({ title: `${field.name}: options saved` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not save options", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit options — {field.name}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end -mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={sortAZ}>
            Sort A→Z
          </Button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1">
          {rows.length === 0 && <p className="text-sm text-gray-500 py-2">No options yet.</p>}
          {rows.map((o, i) => (
            <div key={(o.key || "new") + i} className="flex items-center gap-1">
              <select
                aria-label="Color"
                className="h-8 w-9 rounded border text-xs"
                style={{ backgroundColor: chipColor(o) }}
                value={o.color || ""}
                onChange={(e) => update(i, { color: e.target.value || undefined })}
              >
                {PALETTE.map((c) => (
                  <option key={c || "auto"} value={c} style={{ backgroundColor: c || "#fff" }}>
                    {c ? "■" : "auto"}
                  </option>
                ))}
              </select>
              <Input className="h-8 text-sm" value={o.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Input
            className="h-8 text-sm"
            placeholder="New option"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button size="sm" variant="outline" onClick={add}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save options"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOptionsDialog;
