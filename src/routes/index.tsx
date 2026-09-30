import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Pause, Play, Square, Users, Video, MessageSquare, StickyNote,
  ChevronLeft, FileText, Pencil, Check, Sparkles as _s, Minimize2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "会小纪 · 智能会议记录" },
      { name: "description", content: "会议录音、实时转写气泡、会中便签与客观详细笔记一键生成。" },
      { property: "og:title", content: "会小纪 · 智能会议记录" },
      { property: "og:description", content: "会议录音、实时转写气泡、会中便签与客观详细笔记一键生成。" },
    ],
  }),
  component: App,
});
void _s;

type Speaker = { id: number; label: string; name: string; role: string; color: string };
type Line = { id: number; sp: number; text: string; t: number };
type Note = { id: number; text: string; t: number; tag: string };
type Screen = "home" | "meeting" | "background" | "after";

const COLORS = ["bg-sp1", "bg-sp2", "bg-sp3", "bg-sp4"];
const SCRIPT: [number, string][] = [
  [0, "我们先同步一下新版本的上线进度，目前开发完成度大概百分之八十。"],
  [1, "支付模块还有两个接口没联调完，预计周四可以结束。"],
  [2, "测试这边需要至少三天回归时间，所以最早下周二能提测完成。"],
  [0, "那上线时间定在下周五，十月九号，大家看有没有问题。"],
  [1, "可以，但是第三方支付的证书续期要提前处理，否则会有风险。"],
  [3, "证书续期我来跟进，这周三之前给到结果。"],
  [2, "另外安卓低版本机型的兼容问题还有三个未关闭的缺陷。"],
  [0, "低版本兼容问题优先级调高，周四前给出修复方案。"],
  [3, "市场那边的宣传物料需要在上线前两天确认终稿。"],
  [1, "预算方面这次推广控制在五万元以内。"],
];
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [type, setType] = useState<"现场会议" | "云会议">("现场会议");
  const [sec, setSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [level, setLevel] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "note">("chat");
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const idx = useRef(0);
  const raf = useRef(0);

  const running = (screen === "meeting" || screen === "background") && !paused;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    const f = setInterval(() => {
      if (idx.current >= SCRIPT.length) return;
      const [sp, text] = SCRIPT[idx.current++];
      setSpeakers((prev) =>
        prev.some((p) => p.id === sp)
          ? prev
          : [...prev, { id: sp, label: `说话人 ${String.fromCharCode(65 + sp)}`, name: "", role: "", color: COLORS[sp % 4] }],
      );
      setLines((l) => [...l, { id: Date.now(), sp, text, t: 0 }]);
    }, 3200);
    return () => { clearInterval(t); clearInterval(f); };
  }, [running]);

  async function start() {
    setSec(0); setLines([]); setSpeakers([]); setNotes([]); idx.current = 0; setPaused(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const r = new MediaRecorder(s);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => setAudioUrl(URL.createObjectURL(new Blob(chunks.current, { type: r.mimeType })));
      r.start(1000);
      rec.current = r;
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
        setLevel(m / 128); raf.current = requestAnimationFrame(loop);
      };
      loop();
      setMicOk(true);
    } catch {
      setMicOk(false);
    }
    setScreen("meeting"); setTab("chat");
  }
  function togglePause() {
    const r = rec.current;
    if (r) paused ? r.resume() : r.pause();
    setPaused(!paused);
  }
  function stop() {
    rec.current?.state !== "inactive" && rec.current?.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(raf.current); setLevel(0);
    setScreen("after");
  }

  return (
    <div className="min-h-screen bg-secondary flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen bg-background shadow-xl overflow-hidden">
        {screen === "home" && <Home type={type} setType={setType} onStart={start} />}
        {(screen === "meeting" || screen === "background") && (
          <Meeting
            type={type} sec={sec} paused={paused} micOk={micOk} level={level}
            lines={lines} speakers={speakers} notes={notes} setNotes={setNotes}
            tab={tab} setTab={setTab} onPause={togglePause} onStop={stop}
            onMinimize={() => setScreen("background")}
          />
        )}
        {screen === "background" && (
          <Background type={type} sec={sec} paused={paused} onOpen={() => setScreen("meeting")} />
        )}
        {screen === "after" && (
          <After
            sec={sec} type={type} lines={lines} speakers={speakers} setSpeakers={setSpeakers}
            notes={notes} setNotes={setNotes} audioUrl={audioUrl} onHome={() => setScreen("home")}
          />
        )}
      </div>
    </div>
  );
}

function Logo({ size = 44 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }}
      className="rounded-2xl bg-primary text-primary-foreground grid place-items-center font-serif font-black shadow-lg"
    >
      <span style={{ fontSize: size * 0.45 }}>纪</span>
    </div>
  );
}

function Home({ type, setType, onStart }: { type: string; setType: (t: "现场会议" | "云会议") => void; onStart: () => void }) {
  return (
    <div className="p-6 pt-12 flex flex-col min-h-screen">
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          <h1 className="font-serif font-black text-2xl">会小纪</h1>
          <p className="text-xs text-muted-foreground">录音本地保存 · 会中低打扰</p>
        </div>
      </div>
      <div className="mt-10 rounded-2xl bg-card border p-5">
        <p className="text-sm text-muted-foreground">选择会议类型</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([["现场会议", Users], ["云会议", Video]] as const).map(([t, I]) => (
            <button key={t} onClick={() => setType(t)}
              className={`rounded-xl border-2 p-4 text-left transition ${type === t ? "border-primary bg-primary/5" : "border-transparent bg-muted"}`}>
              <I className="h-5 w-5 text-primary" />
              <div className="mt-2 font-medium">{t}</div>
              <div className="text-xs text-muted-foreground">{t === "现场会议" ? "拾取周围声音" : "配合会议软件使用"}</div>
            </button>
          ))}
        </div>
        <button onClick={onStart}
          className="mt-5 w-full rounded-full bg-primary text-primary-foreground py-4 font-bold text-lg flex items-center justify-center gap-2 active:scale-[.98]">
          <Mic className="h-5 w-5" /> 开始会议
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">待机中 · 00:00</p>
      </div>
      <div className="mt-8">
        <h2 className="font-serif font-semibold">最近会议</h2>
        {["客户需求沟通会 · 9/28 · 42:10", "周例会 · 9/25 · 31:05"].map((m) => (
          <div key={m} className="mt-3 flex items-center gap-3 rounded-xl bg-card border p-4 text-sm">
            <FileText className="h-4 w-4 text-accent" /> {m}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBar({ sec, paused, micOk, level, type }: { sec: number; paused: boolean; micOk: boolean | null; level: number; type: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${paused ? "bg-muted-foreground" : "bg-destructive animate-pulse"}`} />
      <span className="font-mono font-bold">{fmt(sec)}</span>
      <span className="text-muted-foreground">{paused ? "已暂停" : "录音中"} · {type}</span>
      <div className="ml-auto flex items-center gap-1">
        {micOk === false ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4 text-accent" />}
        <div className="flex items-end gap-0.5 h-4">
          {[0.3, 0.6, 1, 0.6, 0.3].map((k, i) => (
            <span key={i} className="w-1 rounded bg-accent transition-all"
              style={{ height: `${Math.max(15, Math.min(100, level * k * 300))}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Avatar({ sp, size = 32 }: { sp: Speaker; size?: number }) {
  return (
    <div style={{ width: size, height: size }}
      className={`${sp.color} shrink-0 rounded-full grid place-items-center text-primary-foreground font-bold text-sm`}>
      {sp.name ? sp.name[0] : String.fromCharCode(65 + sp.id)}
    </div>
  );
}

function Meeting(p: {
  type: string; sec: number; paused: boolean; micOk: boolean | null; level: number;
  lines: Line[]; speakers: Speaker[]; notes: Note[]; setNotes: (f: (n: Note[]) => Note[]) => void;
  tab: "chat" | "note"; setTab: (t: "chat" | "note") => void;
  onPause: () => void; onStop: () => void; onMinimize: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    scroller.current?.querySelectorAll<HTMLElement>("[data-page]").forEach((el) =>
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, [p.lines.length, p.notes.length]);
  function go(t: "chat" | "note") {
    p.setTab(t);
    scroller.current?.scrollTo({ left: t === "chat" ? 0 : scroller.current.clientWidth, behavior: "smooth" });
  }
  function add(tag: string) {
    const text = draft.trim(); if (!text) return;
    p.setNotes((n) => [...n, { id: Date.now(), text, t: p.sec, tag }]); setDraft("");
  }
  return (
    <div className="flex flex-col h-screen">
      <div className="px-4 pt-5 pb-3 border-b bg-card space-y-3">
        <div className="flex items-center">
          <button onClick={p.onMinimize} className="flex items-center gap-1 text-sm text-muted-foreground">
            <Minimize2 className="h-4 w-4" /> 切到后台
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={p.onPause} className="rounded-full bg-muted p-2">{p.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
            <button onClick={p.onStop} className="rounded-full bg-destructive text-primary-foreground px-3 py-2 text-sm flex items-center gap-1"><Square className="h-3.5 w-3.5" />结束</button>
          </div>
        </div>
        <StatusBar {...p} />
        {p.micOk === false && <p className="text-xs text-destructive">未获得麦克风权限，仅演示模拟转写。</p>}
        <div className="grid grid-cols-2 rounded-full bg-muted p-1 text-sm">
          {([["chat", "消息对话", MessageSquare], ["note", "笔记便签", StickyNote]] as const).map(([k, l, I]) => (
            <button key={k} onClick={() => go(k)}
              className={`rounded-full py-1.5 flex items-center justify-center gap-1 ${p.tab === k ? "bg-card shadow font-medium" : "text-muted-foreground"}`}>
              <I className="h-4 w-4" />{l}{k === "note" && p.notes.length > 0 && <span className="text-primary">·{p.notes.length}</span>}
            </button>
          ))}
        </div>
      </div>
      <div ref={scroller}
        onScroll={(e) => { const el = e.currentTarget; p.setTab(el.scrollLeft > el.clientWidth / 2 ? "note" : "chat"); }}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]">
        <div data-page className="w-full shrink-0 snap-start overflow-y-auto p-4 space-y-4">
          {p.lines.length === 0 && <p className="text-center text-sm text-muted-foreground mt-20">正在聆听，转写将以气泡显示…</p>}
          {p.lines.map((l) => {
            const sp = p.speakers.find((s) => s.id === l.sp)!;
            return (
              <div key={l.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                <Avatar sp={sp} />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{sp.name || sp.label}</div>
                  <div className="rounded-2xl rounded-tl-sm bg-card border px-3 py-2 text-sm leading-relaxed">{l.text}</div>
                </div>
              </div>
            );
          })}
          {p.speakers.length > 0 && <p className="text-center text-xs text-muted-foreground">已识别 {p.speakers.length} 位说话人（匿名）</p>}
        </div>
        <div className="w-full shrink-0 snap-start flex flex-col bg-note/30">
          <div data-page className="flex-1 overflow-y-auto p-4 space-y-2">
            {p.notes.length === 0 && <p className="text-center text-sm text-muted-foreground mt-20">记下关键词、短句、待办或人名</p>}
            {p.notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-note px-3 py-2 text-sm shadow-sm flex gap-2">
                <span className="font-mono text-xs text-muted-foreground pt-0.5">{fmt(n.t)}</span>
                <span className="text-xs rounded bg-card px-1.5 py-0.5 h-fit">{n.tag}</span>
                <span>{n.text}</span>
              </div>
            ))}
          </div>
          <div className="p-3 border-t bg-card space-y-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add("短句")}
              placeholder="快速记一笔…" className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ring-ring" />
            <div className="flex gap-2">
              {["关键词", "短句", "待办", "人名"].map((t) => (
                <button key={t} onClick={() => add(t)} className="flex-1 rounded-full bg-muted py-1.5 text-xs active:bg-note">{t}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Background({ type, sec, paused, onOpen }: { type: string; sec: number; paused: boolean; onOpen: () => void }) {
  return (
    <div className="absolute inset-0 z-20 bg-foreground text-background">
      <div className="p-5 pt-8 text-sm opacity-70">{type === "云会议" ? "模拟：会议软件在前台" : "模拟：其他应用在前台"}</div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[3/4] rounded-xl bg-background/10 grid place-items-center"><Users className="h-8 w-8 opacity-40" /></div>)}
      </div>
      <button onClick={onOpen} className="absolute right-4 top-1/2 flex flex-col items-center gap-1 active:scale-95">
        <div className="relative">
          <Logo size={56} />
          {!paused && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive ring-2 ring-foreground animate-pulse" />}
        </div>
        <span className="rounded-full bg-background/90 text-foreground px-2 text-xs font-mono">{fmt(sec)}</span>
      </button>
      <p className="absolute bottom-10 inset-x-0 text-center text-xs opacity-60">录音持续进行 · 点击悬浮「纪」按钮回到记录</p>
    </div>
  );
}

function buildDetailed(lines: Line[], notes: Note[]) {
  const all = lines.map((l) => l.text).join("");
  const has = (k: string) => all.includes(k);
  const sections: { h: string; items: string[] }[] = [
    { h: "会议主题", items: ["新版本上线进度同步与上线计划确认"] },
    { h: "进展情况", items: [
      has("百分之八十") && "新版本整体开发完成度约 80%。",
      has("支付模块") && "支付模块尚有两个接口待联调，预计周四完成。",
      has("三个未关闭") && "安卓低版本机型存在 3 个未关闭的兼容性缺陷。",
    ].filter(Boolean) as string[] },
    { h: "结论与决定", items: [
      has("十月九号") && "上线时间确定为下周五（10 月 9 日）。",
      has("回归") && "测试回归周期不少于 3 天，最早下周二完成提测。",
      has("五万") && "本次推广预算控制在 5 万元以内。",
      has("优先级调高") && "低版本兼容问题优先级上调。",
    ].filter(Boolean) as string[] },
    { h: "行动项", items: [
      has("证书续期我来") && "完成第三方支付证书续期，截止本周三。",
      has("修复方案") && "输出低版本兼容问题修复方案，截止周四。",
      has("物料") && "上线前两天确认宣传物料终稿。",
      ...notes.filter((n) => n.tag === "待办").map((n) => n.text),
    ].filter(Boolean) as string[] },
    { h: "风险提示", items: [has("证书") && "支付证书若未及时续期，将影响上线。"].filter(Boolean) as string[] },
    { h: "补充记录", items: notes.filter((n) => n.tag !== "待办").map((n) => `${n.tag}：${n.text}`) },
  ];
  return sections.filter((s) => s.items.length);
}

function After(p: {
  sec: number; type: string; lines: Line[]; speakers: Speaker[]; setSpeakers: (s: Speaker[]) => void;
  notes: Note[]; setNotes: (f: (n: Note[]) => Note[]) => void; audioUrl: string | null; onHome: () => void;
}) {
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [detail, setDetail] = useState<{ h: string; items: string[] }[] | null>(null);
  const [gen, setGen] = useState(false);
  const [edit, setEdit] = useState(false);
  function generate() {
    setGen(true);
    setTimeout(() => { setDetail(buildDetailed(p.lines, p.notes)); setGen(false); }, 1400);
  }
  return (
    <div className="min-h-screen pb-10">
      <div className="p-4 pt-6 flex items-center gap-2 border-b bg-card sticky top-0 z-10">
        <button onClick={p.onHome}><ChevronLeft className="h-5 w-5" /></button>
        <div>
          <div className="font-serif font-semibold">会议已结束</div>
          <div className="text-xs text-muted-foreground">{p.type} · 时长 {fmt(p.sec)} · 录音已保存在本机</div>
        </div>
      </div>
      <div className="p-4 space-y-5">
        {p.audioUrl ? <audio controls src={p.audioUrl} className="w-full" /> :
          <p className="text-xs text-muted-foreground rounded-lg bg-muted p-3">本次未录到真实音频（未授权麦克风）。</p>}

        <section>
          <h3 className="font-serif font-semibold">说话人标注</h3>
          <p className="text-xs text-muted-foreground">点击头像备注姓名或角色，仅用于对话展示与追问，不进入详细笔记。</p>
          <div className="mt-3 flex gap-4 overflow-x-auto">
            {p.speakers.map((s) => (
              <button key={s.id} onClick={() => setEditing({ ...s })} className="flex flex-col items-center gap-1 min-w-16">
                <div className="relative"><Avatar sp={s} size={48} /><Pencil className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-card p-0.5" /></div>
                <span className="text-xs">{s.name || s.label}</span>
                {s.role && <span className="text-[10px] text-muted-foreground">{s.role}</span>}
              </button>
            ))}
            {p.speakers.length === 0 && <span className="text-sm text-muted-foreground">暂无识别到的说话人</span>}
          </div>
        </section>

        <section>
          <h3 className="font-serif font-semibold">转写记录</h3>
          <div className="mt-2 max-h-56 overflow-y-auto space-y-2 rounded-xl border bg-card p-3">
            {p.lines.map((l) => { const s = p.speakers.find((x) => x.id === l.sp)!; return (
              <div key={l.id} className="flex gap-2 text-sm"><Avatar sp={s} size={22} /><span><b className="font-medium">{s.name || s.label}：</b>{l.text}</span></div>
            ); })}
          </div>
        </section>

        <section>
          <h3 className="font-serif font-semibold">简短笔记</h3>
          <div className="mt-2 space-y-2">
            {p.notes.map((n) => (
              <input key={n.id} value={n.text}
                onChange={(e) => p.setNotes((all) => all.map((x) => x.id === n.id ? { ...x, text: e.target.value } : x))}
                className="w-full rounded-lg bg-note px-3 py-2 text-sm outline-none" />
            ))}
            {p.notes.length === 0 && <p className="text-sm text-muted-foreground">会中未记录便签</p>}
          </div>
        </section>

        {!detail ? (
          <button onClick={generate} disabled={gen}
            className="w-full rounded-full bg-accent text-accent-foreground py-3.5 font-bold disabled:opacity-60">
            {gen ? "正在整合笔记与转写…" : "一键生成详细笔记"}
          </button>
        ) : (
          <section className="rounded-2xl border-2 border-accent bg-card p-4">
            <div className="flex items-center">
              <h3 className="font-serif font-black text-lg">详细会议笔记</h3>
              <button onClick={() => setEdit(!edit)} className="ml-auto text-sm text-accent flex items-center gap-1">
                {edit ? <><Check className="h-4 w-4" />完成</> : <><Pencil className="h-4 w-4" />编辑</>}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">客观事实总结 · 不含说话人归属</p>
            {detail.map((s, si) => (
              <div key={s.h} className="mt-4">
                <h4 className="text-sm font-bold text-primary">{s.h}</h4>
                <ul className="mt-1 space-y-1 text-sm list-disc pl-5">
                  {s.items.map((it, ii) => (
                    <li key={ii}>
                      {edit ? (
                        <input value={it} className="w-full border-b bg-transparent outline-none"
                          onChange={(e) => setDetail(detail.map((x, xi) => xi === si ? { ...x, items: x.items.map((y, yi) => yi === ii ? e.target.value : y) } : x))} />
                      ) : it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-30 bg-foreground/40 flex items-end justify-center" onClick={() => setEditing(null)}>
          <div className="w-full max-w-[430px] rounded-t-3xl bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3"><Avatar sp={editing} size={44} /><span className="font-medium">{editing.label}</span></div>
            <input autoFocus placeholder="真实姓名" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="角色（如 产品经理）" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" />
            <button onClick={() => { p.setSpeakers(p.speakers.map((s) => s.id === editing.id ? editing : s)); setEditing(null); }}
              className="w-full rounded-full bg-primary text-primary-foreground py-3 font-bold">保存</button>
          </div>
        </div>
      )}
    </div>
  );
}
