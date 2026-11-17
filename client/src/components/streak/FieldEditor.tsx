import React, { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, ExternalLink, Pencil, X } from "lucide-react";
import EditOptionsDialog from "./EditOptionsDialog";
import {
  chipColor,
  displayFieldValue,
  isUrl,
  optionsOf,
  setBoxField,
  useInvalidateBoxes,
  type PipelineField,
} from "@/lib/streak";
import { useToast } from "@/hooks/use-toast";

interface Props {
  dealId: number;
  field: PipelineField;
  value: any;
  /** compact = grid cell; otherwise full-width editor in the box sidebar */
  compact?: boolean;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Inline editor for one Streak field value, by field type. Saves immediately, like Streak. */
const FieldEditor: React.FC<Props> = ({ dealId, field, value, compact }) => {
  const invalidate = useInvalidateBoxes();
  const { toast } = useToast();
  const [optimistic, setOptimistic] = useState<any>(value);
  useEffect(() => setOptimistic(value), [value]);

  const save = async (v: any) => {
    const prev = optimistic;
    setOptimistic(v);
    try {
      await setBoxField(dealId, field.id, v);
      invalidate(field.pipelineId, dealId);
    } catch (e: any) {
      setOptimistic(prev);
      toast({ title: `Could not save ${field.name}`, description: e?.message, variant: "destructive" });
    }
  };

  if (field.type === "DROPDOWN" || field.type === "TAG") {
    return <OptionPicker field={field} value={optimistic} onChange={save} compact={compact} />;
  }
  if (field.type === "CHECKBOX") {
    return (
      <div onClick={stop} className={compact ? "flex justify-center" : ""}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-red-600 cursor-pointer"
          checked={!!optimistic}
          onChange={(e) => save(e.target.checked)}
        />
      </div>
    );
  }
  if (field.type === "DATE") {
    const d = optimistic ? new Date(optimistic) : null;
    const iso = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
    return (
      <input
        type="date"
        onClick={stop}
        className={`bg-transparent border rounded px-1 ${compact ? "h-6 text-xs border-transparent hover:border-gray-300" : "h-9 w-full text-sm"}`}
        value={iso}
        onChange={(e) => save(e.target.value ? new Date(e.target.value + "T12:00:00Z").toISOString() : null)}
      />
    );
  }
  return <TextValue field={field} value={optimistic} onSave={save} compact={compact} />;
};

const TextValue: React.FC<{ field: PipelineField; value: any; onSave: (v: any) => void; compact?: boolean }> = ({
  field,
  value,
  onSave,
  compact,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value ?? ""), [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = String(draft).trim();
    if (v !== String(value ?? "")) onSave(v === "" ? null : v);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        onClick={stop}
        className={compact ? "h-6 text-xs px-1" : "h-9 text-sm"}
        type={field.type === "NUMBER" ? "number" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
      />
    );
  }
  const text = value === null || value === undefined ? "" : String(value);
  const link = text && isUrl(text);
  return (
    <div
      onClick={(e) => {
        stop(e);
        setEditing(true);
      }}
      className={`group flex items-center gap-1 cursor-text rounded ${compact ? "min-h-[22px] text-xs" : "min-h-[36px] text-sm px-3 border border-transparent hover:border-gray-300"}`}
      title={text}
    >
      {link ? (
        <a
          href={text.startsWith("http") ? text : `https://${text}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="text-blue-600 hover:underline truncate flex items-center gap-1"
        >
          <span className="truncate">{compact ? "Link" : text}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className={`truncate ${text ? "" : "text-gray-400"}`}>{text || (compact ? "" : "Empty")}</span>
      )}
      {!compact && <Pencil className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-60 shrink-0" />}
    </div>
  );
};

const OptionPicker: React.FC<{ field: PipelineField; value: any; onChange: (v: any) => void; compact?: boolean }> = ({
  field,
  value,
  onChange,
  compact,
}) => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [q, setQ] = useState("");
  const options = optionsOf(field);
  const multi = field.type === "TAG";
  const selected: string[] = multi ? (Array.isArray(value) ? value : value ? [value] : []) : value ? [value] : [];
  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q],
  );
  const exact = options.some((o) => o.name.trim().toLowerCase() === q.trim().toLowerCase());

  const pick = (key: string) => {
    if (multi) {
      const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
      onChange(next.length ? next : null);
    } else {
      onChange(key === value ? null : key);
      setOpen(false);
    }
  };
  const createFromQuery = () => {
    const n = q.trim();
    if (!n) return;
    // Server adds the option to the field when it sees an unknown name
    onChange(multi ? [...selected, n] : n);
    setQ("");
    if (!multi) setOpen(false);
  };

  const chips = selected.map((k) => options.find((o) => o.key === k) || { key: k, name: k });

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQ("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={stop}
            className={`w-full flex items-center gap-1 text-left rounded ${
              compact ? "min-h-[22px] text-xs hover:bg-gray-100 px-0.5" : "min-h-[36px] text-sm border px-2 hover:border-gray-400"
            }`}
          >
            <span className="flex flex-wrap gap-1 flex-1 overflow-hidden">
              {chips.length === 0 ? (
                <span className="text-gray-400">{compact ? "" : `Select ${field.name.toLowerCase()}`}</span>
              ) : (
                chips.map((o) => (
                  <span
                    key={o.key}
                    className="rounded px-1.5 py-0.5 truncate max-w-full"
                    style={{ backgroundColor: chipColor(o as any) }}
                  >
                    {o.name}
                  </span>
                ))
              )}
            </span>
            {!compact && <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start" onClick={stop}>
          <div className="p-2 border-b">
            <Input
              autoFocus
              className="h-8 text-sm"
              placeholder="Search or create…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (filtered.length === 1) pick(filtered[0].key);
                  else if (!exact) createFromQuery();
                }
              }}
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o.key}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 text-left"
                onClick={() => pick(o.key)}
              >
                <span className="w-4">{selected.includes(o.key) && <Check className="h-4 w-4 text-red-600" />}</span>
                <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: chipColor(o) }}>
                  {o.name}
                </span>
              </button>
            ))}
            {q.trim() && !exact && (
              <button
                type="button"
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 text-blue-700"
                onClick={createFromQuery}
              >
                + Create "{q.trim()}"
              </button>
            )}
            {filtered.length === 0 && !q.trim() && <p className="px-3 py-2 text-sm text-gray-500">No options</p>}
          </div>
          <div className="border-t flex">
            {selected.length > 0 && (
              <button
                type="button"
                className="flex-1 px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-1"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <button
              type="button"
              className="flex-1 px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-1 font-medium"
              onClick={() => {
                setOpen(false);
                setEditOpen(true);
              }}
            >
              <Pencil className="h-3 w-3" /> Edit options
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <EditOptionsDialog field={field} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
};

export { displayFieldValue };
export default FieldEditor;
