import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  buildMonthCells, shiftBsMonth, todayBs, NEPALI_MONTHS_EN, NEPALI_MONTHS_NP,
  WEEKDAYS_EN, WEEKDAYS_NP, toNepaliDigits, EVENT_TYPE_META, bsToAdIso, adIsoToBs, BSCell,
} from "@/lib/nepaliCalendar";

type EventType = "holiday" | "exam" | "meeting" | "event" | "notice";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string; // YYYY-MM-DD
  bs_year: number | null;
  bs_month: number | null;
  bs_day: number | null;
  class_id: string | null;
  section_id: string | null;
}

interface ClassRow { id: string; name: string }
interface SectionRow { id: string; name: string; class_id: string }

export default function CalendarPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [{ bsYear, bsMonth }, setStart] = useState(() => todayBs());
  const [view, setView] = useState<"BS" | "AD">("BS");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCell, setSelectedCell] = useState<BSCell | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);

  // 4 months from start
  const months = useMemo(() => {
    return [0, 1, 2, 3].map(i => {
      const s = shiftBsMonth(bsYear, bsMonth, i);
      return { ...s, cells: buildMonthCells(s.bsYear, s.bsMonth) };
    });
  }, [bsYear, bsMonth]);

  // AD date range to fetch events for
  const dateRange = useMemo(() => {
    const all = months.flatMap(m => m.cells.map(c => c.isoDate)).sort();
    return { from: all[0], to: all[all.length - 1] };
  }, [months]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id,title,description,event_type,event_date,bs_year,bs_month,bs_day,class_id,section_id")
        .gte("event_date", dateRange.from)
        .lte("event_date", dateRange.to)
        .order("event_date", { ascending: true });
      if (!cancelled) {
        if (error) toast({ title: "Failed to load events", description: error.message, variant: "destructive" });
        else setEvents((data || []) as CalendarEvent[]);
        setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel("calendar_events_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      supabase.from("classes").select("id,name").order("numeric_level"),
      supabase.from("sections").select("id,name,class_id"),
    ]).then(([c, s]) => {
      setClasses((c.data || []) as ClassRow[]);
      setSections((s.data || []) as SectionRow[]);
    });
  }, [isAdmin]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = map.get(e.event_date) || [];
      arr.push(e);
      map.set(e.event_date, arr);
    }
    return map;
  }, [events]);

  const shift = (delta: number) => setStart(prev => shiftBsMonth(prev.bsYear, prev.bsMonth, delta));

  const monthLabel = (y: number, m: number) =>
    view === "BS"
      ? `${NEPALI_MONTHS_EN[m]} ${y}`
      : (() => {
          const iso = bsToAdIso(y, m, 1);
          const d = new Date(iso);
          return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        })();

  const headerRange = `${monthLabel(months[0].bsYear, months[0].bsMonth)} – ${monthLabel(months[3].bsYear, months[3].bsMonth)}`;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="min-h-screen p-4 md:p-6 space-y-5 animate-fade-in">
        {/* Header */}
        <div className="glass rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <CalendarDays className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Nepali Calendar</h1>
              <p className="text-xs md:text-sm text-muted-foreground">{headerRange}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={view} onValueChange={(v) => setView(v as "BS" | "AD")}>
              <TabsList className="h-9">
                <TabsTrigger value="BS" className="text-xs px-3">BS</TabsTrigger>
                <TabsTrigger value="AD" className="text-xs px-3">AD</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(-4)} title="Previous 4 months">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setStart(todayBs())}>
                Today
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(4)} title="Next 4 months">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => { setEditing(null); setSelectedCell(null); setEditorOpen(true); }}
                className="bg-gradient-primary text-primary-foreground shadow-elegant"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Event
              </Button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          {Object.entries(EVENT_TYPE_META).map(([k, m]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("w-2 h-2 rounded-full", m.dot)} />
              {m.label}
            </div>
          ))}
          <span className="text-xs text-muted-foreground/70 ml-auto">
            {loading ? "Loading…" : `${events.length} events in view`}
          </span>
        </div>

        {/* Months grid: desktop 2x2, tablet 1x2 stacked, mobile 1 month */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {months.map((m, idx) => (
            <MonthCard
              key={`${m.bsYear}-${m.bsMonth}`}
              year={m.bsYear}
              month={m.bsMonth}
              cells={m.cells}
              eventsByDate={eventsByDate}
              view={view}
              className={cn(idx > 1 && "md:hidden lg:block hidden md:hidden")}
              showOnTablet={idx < 2}
              onSelectCell={(c) => setSelectedCell(c)}
            />
          ))}
        </div>

        {/* Day detail dialog */}
        <Dialog open={!!selectedCell && !editorOpen} onOpenChange={(o) => !o && setSelectedCell(null)}>
          <DialogContent className="max-w-lg">
            {selectedCell && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{toNepaliDigits(selectedCell.bsDay)}</span>
                    <span className="text-base font-medium text-muted-foreground">
                      {NEPALI_MONTHS_NP[selectedCell.bsMonth]} {toNepaliDigits(selectedCell.bsYear)}
                    </span>
                  </DialogTitle>
                  <DialogDescription>
                    {new Date(selectedCell.isoDate).toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric", year: "numeric",
                    })}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin pr-1">
                  {(eventsByDate.get(selectedCell.isoDate) || []).length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No events for this day
                    </div>
                  ) : (
                    eventsByDate.get(selectedCell.isoDate)!.map(ev => {
                      const meta = EVENT_TYPE_META[ev.event_type];
                      return (
                        <div key={ev.id} className={cn("rounded-xl border border-border p-3 flex gap-3", meta.bg)}>
                          <span className={cn("w-1.5 rounded-full self-stretch", meta.dot)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold truncate">{ev.title}</h4>
                              <Badge variant="outline" className={cn("text-[10px]", meta.text)}>{meta.label}</Badge>
                            </div>
                            {ev.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.description}</p>}
                            {isAdmin && (
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="ghost" className="h-7 text-xs"
                                  onClick={() => { setEditing(ev); setEditorOpen(true); }}>
                                  <Pencil className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                                  onClick={async () => {
                                    const { error } = await supabase.from("calendar_events").delete().eq("id", ev.id);
                                    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
                                    else toast({ title: "Event deleted" });
                                  }}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {isAdmin && (
                  <DialogFooter>
                    <Button
                      onClick={() => { setEditing(null); setEditorOpen(true); }}
                      className="bg-gradient-primary text-primary-foreground"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add event on this day
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Editor */}
        {isAdmin && (
          <EventEditor
            open={editorOpen}
            onClose={() => { setEditorOpen(false); setEditing(null); }}
            editing={editing}
            initialCell={selectedCell}
            classes={classes}
            sections={sections}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

/* ----------------- Month Card ----------------- */
function MonthCard({
  year, month, cells, eventsByDate, view, onSelectCell, showOnTablet,
}: {
  year: number; month: number; cells: BSCell[];
  eventsByDate: Map<string, CalendarEvent[]>;
  view: "BS" | "AD";
  onSelectCell: (c: BSCell) => void;
  className?: string;
  showOnTablet?: boolean;
}) {
  return (
    <Card className="glass overflow-hidden border-border/60 card-hover">
      <div className="px-4 py-3 border-b border-border/50 flex items-baseline justify-between bg-gradient-to-r from-primary/5 to-transparent">
        <div>
          <div className="text-base font-semibold">
            {NEPALI_MONTHS_EN[month]} <span className="text-muted-foreground font-normal">{year}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">{NEPALI_MONTHS_NP[month]} {toNepaliDigits(year)}</div>
        </div>
      </div>
      <CardContent className="p-2">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS_EN.map((d, i) => (
            <div key={d} className={cn(
              "text-center text-[10px] font-medium uppercase tracking-wider py-1",
              i === 6 ? "text-rose-500" : "text-muted-foreground"
            )}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            const dayEvents = eventsByDate.get(c.isoDate) || [];
            const isSat = c.weekday === 6;
            const hasHoliday = dayEvents.some(e => e.event_type === "holiday");
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectCell(c)}
                    className={cn(
                      "group relative aspect-square rounded-lg p-1 text-left transition-all",
                      "hover:bg-accent/60 hover:shadow-soft hover:scale-[1.04]",
                      "focus:outline-none focus:ring-2 focus:ring-ring",
                      !c.isCurrentMonth && "opacity-35",
                      c.isToday && "bg-gradient-primary text-primary-foreground shadow-glow hover:bg-gradient-primary",
                      hasHoliday && !c.isToday && "bg-rose-500/5"
                    )}
                  >
                    <div className="flex flex-col h-full">
                      <span className={cn(
                        "text-base font-bold leading-none",
                        c.isToday ? "text-primary-foreground" :
                          (isSat || hasHoliday) ? "text-rose-500" : "text-foreground"
                      )}>
                        {view === "BS" ? toNepaliDigits(c.bsDay) : c.adDay}
                      </span>
                      <span className={cn(
                        "text-[9px] leading-none mt-0.5",
                        c.isToday ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {view === "BS" ? c.adDay : toNepaliDigits(c.bsDay)}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="mt-auto flex gap-0.5 flex-wrap">
                          {dayEvents.slice(0, 4).map(e => (
                            <span key={e.id} className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              EVENT_TYPE_META[e.event_type].dot
                            )} />
                          ))}
                          {dayEvents.length > 4 && (
                            <span className={cn("text-[8px] leading-none ml-0.5",
                              c.isToday ? "text-primary-foreground/80" : "text-muted-foreground")}>
                              +{dayEvents.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </TooltipTrigger>
                {dayEvents.length > 0 && (
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      {dayEvents.slice(0, 5).map(e => (
                        <div key={e.id} className="flex items-center gap-1.5 text-xs">
                          <span className={cn("w-1.5 h-1.5 rounded-full", EVENT_TYPE_META[e.event_type].dot)} />
                          <span className="truncate">{e.title}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------- Event Editor ----------------- */
function EventEditor({
  open, onClose, editing, initialCell, classes, sections,
}: {
  open: boolean;
  onClose: () => void;
  editing: CalendarEvent | null;
  initialCell: BSCell | null;
  classes: ClassRow[];
  sections: SectionRow[];
}) {
  const today = todayBs();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("event");
  const [bsY, setBsY] = useState(today.bsYear);
  const [bsM, setBsM] = useState(today.bsMonth);
  const [bsD, setBsD] = useState(today.bsDay);
  const [classId, setClassId] = useState<string>("__all__");
  const [sectionId, setSectionId] = useState<string>("__all__");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description || "");
      setEventType(editing.event_type);
      const bs = editing.bs_year && editing.bs_month != null && editing.bs_day
        ? { bsYear: editing.bs_year, bsMonth: editing.bs_month, bsDay: editing.bs_day }
        : adIsoToBs(editing.event_date);
      setBsY(bs.bsYear); setBsM(bs.bsMonth); setBsD(bs.bsDay);
      setClassId(editing.class_id || "__all__");
      setSectionId(editing.section_id || "__all__");
    } else if (initialCell) {
      setTitle(""); setDescription(""); setEventType("event");
      setBsY(initialCell.bsYear); setBsM(initialCell.bsMonth); setBsD(initialCell.bsDay);
      setClassId("__all__"); setSectionId("__all__");
    } else {
      setTitle(""); setDescription(""); setEventType("event");
      setBsY(today.bsYear); setBsM(today.bsMonth); setBsD(today.bsDay);
      setClassId("__all__"); setSectionId("__all__");
    }
  }, [open, editing, initialCell]);

  const filteredSections = sections.filter(s => classId === "__all__" || s.class_id === classId);

  const adPreview = useMemo(() => {
    try { return bsToAdIso(bsY, bsM, bsD); } catch { return ""; }
  }, [bsY, bsM, bsD]);

  async function save() {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      event_date: adPreview,
      bs_year: bsY, bs_month: bsM, bs_day: bsD,
      class_id: classId === "__all__" ? null : classId,
      section_id: sectionId === "__all__" ? null : sectionId,
    };
    const { error } = editing
      ? await supabase.from("calendar_events").update(payload).eq("id", editing.id)
      : await supabase.from("calendar_events").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Event updated" : "Event added" });
      onClose();
    }
  }

  const daysInMonth = (() => {
    try {
      const all = buildMonthCells(bsY, bsM).filter(c => c.isCurrentMonth);
      return all.length;
    } catch { return 30; }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle>
          <DialogDescription>BS date is primary; AD date is auto-computed.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dashain Holiday" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details" />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", m.dot)} /> {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">BS Year</Label>
              <Input type="number" value={bsY} onChange={e => setBsY(+e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">BS Month</Label>
              <Select value={String(bsM)} onValueChange={(v) => setBsM(+v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NEPALI_MONTHS_EN.map((n, i) => (
                    <SelectItem key={i} value={String(i)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">BS Day</Label>
              <Input type="number" min={1} max={daysInMonth} value={bsD}
                onChange={e => setBsD(Math.min(daysInMonth, Math.max(1, +e.target.value || 1)))} />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            AD: <span className="text-foreground font-medium">{adPreview || "—"}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Class (optional)</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId("__all__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Section (optional)</Label>
              <Select value={sectionId} onValueChange={setSectionId} disabled={classId === "__all__"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sections</SelectItem>
                  {filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground">
            {saving ? "Saving…" : editing ? "Save changes" : "Add event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}