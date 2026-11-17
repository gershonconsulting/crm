import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { FIELD_TYPE_LABELS, useInvalidateBoxes, type PipelineField } from "@/lib/streak";
import { useToast } from "@/hooks/use-toast";

interface Props {
  pipelineId: number;
  /** When set, rename/delete this field; otherwise create a new one */
  field?: PipelineField | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Add a column (field) to the pipeline, or rename / delete one — like Streak's column menu. */
const FieldDialog: React.FC<Props> = ({ pipelineId, field, open, onOpenChange }) => {
  const [name, setName] = useState("");
  const [type, setType] = useState("TEXT");
  const [opts, setOpts] = useState("");
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidateBoxes();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(field?.name || "");
      setType(field?.type || "TEXT");
      setOpts("");
    }
  }, [open, field]);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (field) {
        await apiRequest("PUT", `/api/fields/${field.id}`, { name: name.trim() });
      } else {
        await apiRequest("POST", `/api/pipelines/${pipelineId}/fields`, {
          name: name.trim(),
          type,
          options: opts.split("\n").map((s) => s.trim()).filter(Boolean),
        });
      }
      invalidate(pipelineId);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not save field", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!field) return;
    if (!window.confirm(`Delete the field "${field.name}" from this pipeline?`)) return;
    setBusy(true);
    try {
      await apiRequest("DELETE", `/api/fields/${field.id}`);
      invalidate(pipelineId);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{field ? `Edit field — ${field.name}` : "Add field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          {!field && (
            <>
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <select className="w-full h-9 border rounded px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              {(type === "DROPDOWN" || type === "TAG") && (
                <div>
                  <label className="text-xs text-gray-500">Options (one per line — you can edit them later)</label>
                  <Textarea rows={5} value={opts} onChange={(e) => setOpts(e.target.value)} />
                </div>
              )}
            </>
          )}
          {field && <p className="text-xs text-gray-500">Type: {FIELD_TYPE_LABELS[field.type] || field.type}</p>}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {field ? (
            <Button variant="ghost" className="text-red-600" onClick={remove} disabled={busy}>
              Delete field
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={submit} disabled={busy || !name.trim()}>
              {field ? "Save" : "Add field"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FieldDialog;
