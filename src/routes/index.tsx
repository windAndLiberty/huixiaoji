import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Mic, MicOff, Pause, Play, Square, Users, Video, MessageSquare, StickyNote,
  ChevronLeft, FileText, Pencil, Check, Sparkles as _s, Minimize2,
  Heading1, List, ListChecks, Minus, AudioLines, ArrowUpRight, ArrowRight, Clock3, ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "会小纪 · 智能会议记录" },
      { name: "description", content: "会议录音、实时转写气泡、会中便签与客观详细笔记一键生成。" },
      { property: "og:title", content: "会小纪 · 智能会议记录" },
      { property: "og:description", content: "会议录音、实时转写气泡、会中便签与客观详细笔记一键生成。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});
void _s;

type Speaker = { id: number; label: string; name: string; role: string; color: string };
type Line = { id: number; sp: number; text: string; t: number };
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
  const [pad, setPad] = useState("");
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
      const [sp, text] = SCRIPT[idx.current++] as [number, string];
      setSpeakers((prev) =>
        prev.some((p) => p.id === sp)
          ? prev
          : [...prev, { id: sp, label: `说话人 ${String.fromCharCode(65 + sp)}`, name: "", role: "", color: COLORS[sp % 4] ?? "bg-sp1" }],
      );
      setLines((l) => [...l, { id: Date.now(), sp, text, t: 0 }]);
    }, 3200);
    return () => { clearInterval(t); clearInterval(f); };
  }, [running]);

  async function start() {
    setSec(0); setLines([]); setSpeakers([]); setPad(""); idx.current = 0; setPaused(false);
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
    <div className="app-stage min-h-screen flex justify-center">
      <div className={`app-shell relative w-full min-h-screen text-foreground overflow-hidden ${screen === "home" ? "home-shell" : "session-shell"}`}>
        {screen === "home" && <Home type={type} setType={setType} onStart={start} />}
        {(screen === "meeting" || screen === "background") && (
          <Meeting
            type={type} sec={sec} paused={paused} micOk={micOk} level={level}
            lines={lines} speakers={speakers} pad={pad} setPad={setPad}
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
            pad={pad} setPad={setPad} audioUrl={audioUrl} onHome={() => setScreen("home")}
          />
        )}
      </div>
    </div>
  );
}

function Logo({ size = 44 }: { size?: number }) {
  return <div style={{ width: size, height: size }} className="brand-mark shrink-0 grid place-items-center"><AudioLines className="h-6 w-6" /></div>;
}

const KEY_HEIGHTS = [38, 58, 76, 92, 104, 88, 68, 96, 80, 60, 74, 52, 64, 44, 54, 36];
const KEY_TINTS = ["--sp1", "--sp2", "--accent", "--sp3", "--sp4", "--sp2", "--sp1", "--accent", "--sp3", "--sp4", "--sp1", "--sp2", "--sp3", "--accent", "--sp4", "--sp1"];

function GlassKeys() {
  const [press, setPress] = useState({ i: -1, n: 0 });
  return (
    <div className="glass-keys" role="group" aria-label="玻璃声波键">
      {KEY_HEIGHTS.map((h, i) => {
        const cls = press.n === 0 ? "" : i === press.i ? "is-pressed" : "is-ripple";
        return (
          <Button variant="plain" size="plain" key={`${i}-${press.n}`} tabIndex={-1} aria-label={`声波键 ${i + 1}`}
            onClick={() => setPress({ i, n: press.n + 1 })}
            className={`glass-key shrink-0 ${cls}`}
            style={{
              height: `${h}%`, borderRadius: 7,
              ["--tint"]: `var(${KEY_TINTS[i] ?? "--sp1"})`,
              animationDelay: cls === "is-ripple" ? `${Math.min(Math.abs(i - press.i) * 26, 260)}ms` : undefined,
            } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

function Home({ type, setType, onStart }: { type: string; setType: (t: "现场会议" | "云会议") => void; onStart: () => void }) {
  return (
    <div className="home-page">
      <header className="home-header flex items-center justify-between">
        <div className="flex items-center gap-2.5"><Logo size={36} /><span className="text-lg font-bold">会小纪<span className="brand-dot">.</span></span></div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-accent" />准备就绪</span>
      </header>
      <main className="home-main">
        <div className="home-intro text-center">
          <p className="eyebrow">留住每一个重要时刻</p>
          <h1 className="mt-3 text-[34px] font-bold leading-tight">会小纪</h1>
          <p className="mt-3 text-sm text-muted-foreground">专注对话，让记录自然发生。</p>
        </div>
        <div className="voice-art"><GlassKeys /></div>
        <div className="record-setup">
          <div className="meeting-type grid grid-cols-2 gap-2">
            {([["现场会议", Users], ["云会议", Video]] as const).map(([t, I]) => (
              <Button variant="plain" size="plain" key={t} onClick={() => setType(t)} aria-pressed={type === t}
                className={`type-choice ${type === t ? "is-selected" : ""}`}>
                <I className="h-4 w-4" /><span>{t}</span>{type === t && <Check className="ml-auto h-3.5 w-3.5" />}
              </Button>
            ))}
          </div>
          <Button variant="plain" size="plain" onClick={onStart} className="start-meeting w-full"><Mic className="h-5 w-5" />开始会议<ArrowRight className="ml-auto h-5 w-5" /></Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3 w-3" />{type === "现场会议" ? "麦克风录音" : "配合会议软件录音"}<span className="mx-1">·</span><span className="font-mono">00:00</span></p>
        </div>
      </main>
      <section className="recent-section">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">最近会议</h2><span className="text-[10px] text-muted-foreground">示例记录</span></div>
        {[["客户需求沟通会", "9月28日", "42:10"], ["产品周例会", "9月25日", "31:05"]].map(([title, date, time]) => (
          <div key={title} className="recent-row flex items-center gap-3">
            <div className="record-icon"><FileText className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">{date}<span>·</span><Clock3 className="h-3 w-3" />{time}</p></div>
            <span className="text-[10px] text-muted-foreground">已结束</span>
          </div>
        ))}
      </section>
      <footer className="home-footer"><AudioLines className="h-3 w-3" /><span>会小纪 · 让沟通有迹可循</span></footer>
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
  lines: Line[]; speakers: Speaker[]; pad: string; setPad: (v: string) => void;
  tab: "chat" | "note"; setTab: (t: "chat" | "note") => void;
  onPause: () => void; onStop: () => void; onMinimize: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    scroller.current?.querySelectorAll<HTMLElement>("[data-page]").forEach((el) =>
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, [p.lines.length]);
  function go(t: "chat" | "note") {
    p.setTab(t);
    scroller.current?.scrollTo({ left: t === "chat" ? 0 : scroller.current.clientWidth, behavior: "smooth" });
    if (t === "note") requestAnimationFrame(() => ta.current?.focus());
  }
  function togglePrefix(prefix: string) {
    const el = ta.current; if (!el) return;
    const pad = p.pad;
    const s = el.selectionStart, e = el.selectionEnd;
    const ls = pad.lastIndexOf("\n", s - 1) + 1;
    let le = pad.indexOf("\n", e); if (le === -1) le = pad.length;
    const block = pad.slice(ls, le).split("\n");
    const all = block.every((l) => l.startsWith(prefix));
    const next = block.map((l) => (all ? (l.startsWith(prefix) ? l.slice(prefix.length) : l) : prefix + l)).join("\n");
    p.setPad(pad.slice(0, ls) + next + pad.slice(le));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ls, ls + next.length); });
  }
  function insertDivider() {
    const el = ta.current; if (!el) return;
    const s = el.selectionStart;
    const pad = p.pad;
    const lead = s === 0 || pad[s - 1] === "\n" ? "" : "\n";
    const ins = `${lead}⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯\n`;
    p.setPad(pad.slice(0, s) + ins + pad.slice(s));
    requestAnimationFrame(() => { el.focus(); const pos = s + ins.length; el.setSelectionRange(pos, pos); });
  }
  return (
    <div className="meeting-page flex flex-col h-dvh">
      <div className="session-header px-5 pt-5 pb-4 space-y-4">
        <div className="flex items-center">
          <Button variant="plain" size="plain" onClick={p.onMinimize} className="flex items-center gap-1 text-sm text-muted-foreground">
            <Minimize2 className="h-4 w-4" /> 切到后台
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="plain" size="plain" onClick={p.onPause} title={p.paused ? "继续录音" : "暂停录音"} aria-label={p.paused ? "继续录音" : "暂停录音"} className="rounded-full bg-muted p-2">{p.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
            <Button variant="plain" size="plain" onClick={p.onStop} className="rounded-full bg-destructive text-destructive-foreground px-3 py-2 text-sm flex items-center gap-1"><Square className="h-3.5 w-3.5" />结束</Button>
          </div>
        </div>
        <StatusBar {...p} />
        {p.micOk === false && <p className="text-xs text-destructive">未获得麦克风权限，仅演示模拟转写。</p>}
        <div className="session-tabs grid grid-cols-2 rounded-full bg-muted/60 p-1 text-sm">
          {([["chat", "消息对话", MessageSquare], ["note", "笔记便签", StickyNote]] as const).map(([k, l, I]) => (
            <Button variant="plain" size="plain" key={k} onClick={() => go(k)}
              className={`rounded-full py-1.5 flex items-center justify-center gap-1 ${p.tab === k ? "bg-card shadow font-medium" : "text-muted-foreground"}`}>
              <I className="h-4 w-4" />{l}
            </Button>
          ))}
        </div>
      </div>
      <div ref={scroller}
        onScroll={(e) => { const el = e.currentTarget; p.setTab(el.scrollLeft > el.clientWidth / 2 ? "note" : "chat"); }}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]">
        <div data-page className="w-full shrink-0 snap-start overflow-y-auto p-5 space-y-5">
          {p.lines.length === 0 && <p className="text-center text-sm text-muted-foreground mt-20">正在聆听，转写将以气泡显示…</p>}
          {p.lines.map((l) => {
            const sp = p.speakers.find((s) => s.id === l.sp);
            if (!sp) return null;
            return (
              <div key={l.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                <Avatar sp={sp} />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{sp.name || sp.label}</div>
                  <div className="transcript-bubble rounded-lg bg-card px-4 py-3 text-sm leading-7">{l.text}</div>
                </div>
              </div>
            );
          })}
          {p.speakers.length > 0 && <p className="text-center text-xs text-muted-foreground">已识别 {p.speakers.length} 位说话人（匿名）</p>}
        </div>
        <div className="w-full shrink-0 snap-start flex flex-col bg-note/30">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/60 bg-card/90 overflow-x-auto [scrollbar-width:none]">
            {([["标题", Heading1, "# "], ["列表", List, "• "], ["待办", ListChecks, "□ "]] as const).map(([label, I, pre]) => (
              <Button variant="plain" size="plain" key={label} title={label} aria-label={label} onClick={() => togglePrefix(pre)}
                className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs shrink-0 active:bg-note">
                <I className="h-4 w-4" />
              </Button>
            ))}
            <Button variant="plain" size="plain" onClick={insertDivider} title="分割线" aria-label="分割线"
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs shrink-0 active:bg-note">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="ml-auto pr-1 text-[10px] text-muted-foreground shrink-0">自动保存</span>
          </div>
          <textarea ref={ta} value={p.pad} onChange={(e) => p.setPad(e.target.value)}
            placeholder="记下此刻的想法…"
            className="notepad flex-1 w-full resize-none bg-transparent px-5 pt-0 pb-6 text-sm leading-8 outline-hidden placeholder:text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function Background({ type, sec, paused, onOpen }: { type: string; sec: number; paused: boolean; onOpen: () => void }) {
  return (
    <div className="absolute inset-0 z-20 bg-secondary text-foreground">
      <div className="p-5 pt-8 text-sm opacity-70">{type === "云会议" ? "模拟：会议软件在前台" : "模拟：其他应用在前台"}</div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[3/4] rounded-md border border-border bg-card grid place-items-center"><Users className="h-8 w-8 opacity-40" /></div>)}
      </div>
      <Button variant="plain" size="plain" onClick={onOpen} className="absolute right-4 top-1/2 flex flex-col items-center gap-1 active:scale-95">
        <div className="relative">
          <Logo size={56} />
          {!paused && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive ring-2 ring-secondary animate-pulse" />}
        </div>
        <span className="rounded-full bg-card text-foreground px-2 text-xs font-mono">{fmt(sec)}</span>
      </Button>
      <p className="absolute bottom-10 inset-x-0 text-center text-xs opacity-60">录音持续进行 · 点击悬浮「纪」按钮回到记录</p>
    </div>
  );
}

function buildDetailed(lines: Line[], pad: string) {
  const all = lines.map((l) => l.text).join("");
  const has = (k: string) => all.includes(k);
  const padLines = pad.split("\n").map((l) => l.trim()).filter(Boolean);
  const todos = padLines.filter((l) => l.startsWith("□")).map((l) => l.replace(/^□\s*/, ""));
  const extras = padLines.filter((l) => !l.startsWith("□")).map((l) => l.replace(/^(#|•)\s*/, ""));
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
      ...todos,
    ].filter(Boolean) as string[] },
    { h: "风险提示", items: [has("证书") && "支付证书若未及时续期，将影响上线。"].filter(Boolean) as string[] },
    { h: "补充记录", items: extras },
  ];
  return sections.filter((s) => s.items.length);
}

function After(p: {
  sec: number; type: string; lines: Line[]; speakers: Speaker[]; setSpeakers: (s: Speaker[]) => void;
  pad: string; setPad: (v: string) => void; audioUrl: string | null; onHome: () => void;
}) {
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [detail, setDetail] = useState<{ h: string; items: string[] }[] | null>(null);
  const [gen, setGen] = useState(false);
  const [edit, setEdit] = useState(false);
  function generate() {
    setGen(true);
    setTimeout(() => { setDetail(buildDetailed(p.lines, p.pad)); setGen(false); }, 1400);
  }
  return (
    <div className="after-page min-h-screen pb-10">
      <div className="session-header p-5 pt-6 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="plain" size="plain" onClick={p.onHome} title="返回首页" aria-label="返回首页"><ChevronLeft className="h-5 w-5" /></Button>
        <div>
          <div className="font-serif font-semibold">会议已结束</div>
          <div className="text-xs text-muted-foreground">{p.type} · 时长 {fmt(p.sec)}</div>
        </div>
      </div>
      <div className="p-5 space-y-7">
        {p.audioUrl ? <audio controls src={p.audioUrl} className="w-full" /> :
          <p className="text-xs text-muted-foreground rounded-lg bg-muted p-3">本次未录到真实音频（未授权麦克风）。</p>}

        <section>
          <h3 className="font-serif font-semibold">说话人标注</h3>
          <p className="text-xs text-muted-foreground">匿名识别 · 可备注姓名与角色</p>
          <div className="mt-3 flex gap-4 overflow-x-auto">
            {p.speakers.map((s) => (
              <Button variant="plain" size="plain" key={s.id} onClick={() => setEditing({ ...s })} className="flex flex-col items-center gap-1 min-w-16">
                <div className="relative"><Avatar sp={s} size={48} /><Pencil className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-card p-0.5" /></div>
                <span className="text-xs">{s.name || s.label}</span>
                {s.role && <span className="text-[10px] text-muted-foreground">{s.role}</span>}
              </Button>
            ))}
            {p.speakers.length === 0 && <span className="text-sm text-muted-foreground">暂无识别到的说话人</span>}
          </div>
        </section>

        <section>
          <h3 className="font-serif font-semibold">转写记录</h3>
          <div className="mt-3 max-h-56 overflow-y-auto space-y-4 transcript-bubble rounded-lg bg-card p-4">
            {p.lines.map((l) => { const s = p.speakers.find((x) => x.id === l.sp); if (!s) return null; return (
              <div key={l.id} className="flex gap-2 text-sm"><Avatar sp={s} size={22} /><span><b className="font-medium">{s.name || s.label}：</b>{l.text}</span></div>
            ); })}
          </div>
        </section>

        <section>
          <h3 className="font-serif font-semibold">简短笔记</h3>
          <p className="text-xs text-muted-foreground"></p>
          <div className="mt-3 rounded-lg bg-note/40">
            <textarea value={p.pad} onChange={(e) => p.setPad(e.target.value)} rows={Math.max(3, p.pad.split("\n").length + 1)}
              placeholder="会中未记录便签，可在此补记…"
              className="notepad w-full resize-none bg-transparent rounded-xl px-3 pt-0 pb-2 text-sm leading-8 outline-hidden placeholder:text-muted-foreground" />
          </div>
        </section>

        {!detail ? (
          <Button variant="plain" size="plain" onClick={generate} disabled={gen}
            className="w-full rounded-full bg-accent text-accent-foreground py-3.5 font-bold disabled:opacity-60">
            {gen ? "正在整合笔记与转写…" : "一键生成详细笔记"}
          </Button>
        ) : (
          <section className="detail-notes border-t border-border pt-6">
            <div className="flex items-center">
              <h3 className="font-serif font-black text-lg">详细会议笔记</h3>
              <Button variant="plain" size="plain" onClick={() => setEdit(!edit)} className="ml-auto text-sm text-accent flex items-center gap-1">
                {edit ? <><Check className="h-4 w-4" />完成</> : <><Pencil className="h-4 w-4" />编辑</>}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">会议摘要</p>
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
          <div className="w-full max-w-[480px] rounded-t-2xl bg-card p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3"><Avatar sp={editing} size={44} /><span className="font-medium">{editing.label}</span></div>
            <input autoFocus placeholder="真实姓名" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="角色（如 产品经理）" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" />
            <Button variant="plain" size="plain" onClick={() => { p.setSpeakers(p.speakers.map((s) => s.id === editing.id ? editing : s)); setEditing(null); }}
              className="w-full rounded-full bg-primary text-primary-foreground py-3 font-bold">保存</Button>
          </div>
        </div>
      )}
    </div>
  );
}
