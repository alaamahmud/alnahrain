// مقر الشركة الحي — AI Company HQ
// كل موظف "عقل" مستقل: في كل دورة يقرر ماذا يفعل (يعمل، يتكلم مع زميل، يأخذ استراحة، يجتمع...)
// بناءً على شخصيته وطاقته ومزاجه وذاكرته والمهام المفتوحة. اللوحة تتحدث مباشرة عبر SSE.
//
// - إذا وُجد ANTHROPIC_API_KEY: القرارات والكلام يولّدها Claude فعلاً.
// - بدونه: محرك سلوك محلي (وضع المحاكاة) حتى تشتغل اللوحة فوراً.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.MODEL || "claude-opus-5-5";
const TICK_MS = Number(process.env.TICK_MS || 4000);

// ---------------------------------------------------------------- Claude
let client = null;
if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  client = new Anthropic();
}

// ---------------------------------------------------------------- العالم
const ROOMS = {
  desk: "المكتب",
  meeting: "غرفة الاجتماعات",
  kitchen: "المطبخ",
  lounge: "الاستراحة",
  ceo: "مكتب المدير",
};

const employees = [
  { id: "sara", name: "سارة", role: "مديرة المنتج", emoji: "👩‍💼", color: "#e76f51",
    personality: "منظمة، حاسمة، تحب الاجتماعات القصيرة وتتابع المواعيد" },
  { id: "omar", name: "عمر", role: "مهندس برمجيات", emoji: "👨‍💻", color: "#2a9d8f",
    personality: "هادئ، يحب التركيز العميق، يشرب قهوة كثيرة، يكره المقاطعة" },
  { id: "layla", name: "ليلى", role: "مصممة واجهات", emoji: "👩‍🎨", color: "#9b5de5",
    personality: "مبدعة، عفوية، تطلب آراء الزملاء دائماً، تحب الموسيقى" },
  { id: "hassan", name: "حسن", role: "مسوّق", emoji: "🧑‍💼", color: "#f4a261",
    personality: "اجتماعي جداً، كثير الكلام، متفائل، يحب الأرقام والحملات" },
  { id: "noor", name: "نور", role: "محللة بيانات", emoji: "👩‍🔬", color: "#457b9d",
    personality: "دقيقة، تحب الأدلة، تسأل أسئلة صعبة، انطوائية قليلاً" },
  { id: "ali", name: "علي", role: "دعم العملاء", emoji: "🧑‍🔧", color: "#e9c46a",
    personality: "صبور، ودود، ينقل شكاوى العملاء للفريق، يحب المزاح" },
].map((e) => ({
  ...e,
  room: "desk",
  activity: "يصل إلى المكتب",
  thought: "",
  say: "",
  sayTo: null,
  energy: 70 + Math.floor(Math.random() * 30),
  mood: "😊",
  taskId: null,
  memory: [],
  busyUntil: 0,
}));

let taskSeq = 1;
const tasks = [
  { id: taskSeq++, title: "تصميم صفحة الهبوط الجديدة", status: "todo", owner: null, progress: 0 },
  { id: taskSeq++, title: "إصلاح خطأ تسجيل الدخول", status: "todo", owner: null, progress: 0 },
  { id: taskSeq++, title: "تحليل مبيعات الشهر الماضي", status: "todo", owner: null, progress: 0 },
  { id: taskSeq++, title: "خطة حملة إعلانية للعيد", status: "todo", owner: null, progress: 0 },
];

const feed = []; // آخر الأحداث
let clockMinutes = 9 * 60; // ساعة الشركة الافتراضية تبدأ 9:00

function log(kind, text, who = null) {
  const item = { t: Date.now(), clock: clockStr(), kind, text, who };
  feed.unshift(item);
  feed.length = Math.min(feed.length, 80);
  broadcast("feed", item);
}

function clockStr() {
  const h = Math.floor(clockMinutes / 60) % 24;
  const m = clockMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function remember(e, text) {
  e.memory.push(`[${clockStr()}] ${text}`);
  if (e.memory.length > 8) e.memory.shift();
}

function snapshot() {
  return {
    mode: client ? "claude" : "sim",
    model: client ? MODEL : null,
    clock: clockStr(),
    employees: employees.map(({ memory, busyUntil, ...rest }) => rest),
    tasks,
    rooms: ROOMS,
  };
}

// ---------------------------------------------------------------- SSE
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

// ---------------------------------------------------------------- القرار
const DECISION_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["work", "talk", "move", "break", "meeting", "pick_task", "finish_task"] },
    room: { type: "string", enum: Object.keys(ROOMS) },
    talk_to: { type: "string", description: "id الزميل أو none" },
    task_id: { type: "integer", description: "رقم المهمة أو 0" },
    activity: { type: "string", description: "وصف قصير لما تفعله الآن بصيغة الغائب، مثل: يراجع الكود" },
    say: { type: "string", description: "جملة تقولها بصوت عالٍ بالعربية العامية، أو فارغ" },
    thought: { type: "string", description: "فكرة داخلية قصيرة" },
    mood: { type: "string", description: "إيموجي واحد يعبر عن المزاج" },
  },
  required: ["action", "room", "talk_to", "task_id", "activity", "say", "thought", "mood"],
  additionalProperties: false,
};

function worldDescription(me) {
  const others = employees
    .filter((o) => o.id !== me.id)
    .map((o) => `- ${o.id} (${o.name}، ${o.role}) في ${ROOMS[o.room]}: ${o.activity}${o.say ? ` — قال: "${o.say}"` : ""}`)
    .join("\n");
  const t = tasks
    .filter((x) => x.status !== "done")
    .map((x) => `- #${x.id} "${x.title}" [${x.status}] ${x.owner ? `مع ${x.owner}` : "بدون مسؤول"} ${x.progress}%`)
    .join("\n");
  const heard = feed
    .filter((f) => f.kind === "say" && f.text.includes(me.name))
    .slice(0, 3)
    .map((f) => `- ${f.text}`)
    .join("\n");
  return `الساعة ${clockStr()}.
أنت في: ${ROOMS[me.room]}. نشاطك الحالي: ${me.activity}. طاقتك ${me.energy}/100. مزاجك ${me.mood}.
${me.taskId ? `مهمتك الحالية: #${me.taskId}` : "ليس لديك مهمة الآن."}

الزملاء:
${others}

المهام المفتوحة:
${t || "- لا توجد"}

كلام موجّه لك مؤخراً:
${heard || "- لا شيء"}

ذاكرتك القريبة:
${me.memory.join("\n") || "- بداية اليوم"}

ماذا تفعل الآن؟ تصرّف كإنسان حقيقي: إذا طاقتك منخفضة خذ استراحة أو قهوة، إذا كلمك أحد فرد عليه،
إذا لا مهمة لك فاختر واحدة (pick_task)، إذا مهمتك قاربت الانتهاء أنهِها (finish_task). كن طبيعياً وموجزاً.`;
}

async function decideWithClaude(me) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: DECISION_SCHEMA },
    },
    system: `أنت ${me.name}، ${me.role} في شركة ناشئة عراقية صغيرة اسمها "النهرين". شخصيتك: ${me.personality}.
أنت موظف حقيقي في يوم عمل عادي. تكلم بلهجة عربية طبيعية ودودة. لا تذكر أنك ذكاء اصطناعي.`,
    messages: [{ role: "user", content: worldDescription(me) }],
  });
  if (response.stop_reason === "refusal") throw new Error("refusal");
  const text = response.content.find((b) => b.type === "text")?.text;
  return JSON.parse(text);
}

// محرك السلوك المحلي (بدون مفتاح API)
const LINES = {
  work: ["خلّيني أركز شوي", "تقريباً خلصت هذا الجزء", "هممم، هذا أصعب مما توقعت", "تمام، ماشي الحال"],
  talk: ["شلونك اليوم؟", "شفت آخر تحديث؟ شنو رأيك؟", "تقدر تساعدني بشغلة صغيرة؟", "عندي فكرة، اسمعني دقيقة"],
  reply: ["أكيد، تفضل", "زين، خليني أشوف", "والله فكرة حلوة!", "بعد شوية أجيلك"],
  break: ["أحتاج قهوة ☕", "استراحة خمس دقايق", "رجلي تعبت من القعدة", "منو يريد شاي؟"],
  meeting: ["يلا نجتمع عشر دقايق", "خلونا نراجع الأولويات", "شنو آخر الأخبار يا جماعة؟"],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function decideLocally(me) {
  const recentToMe = feed.find((f) => f.kind === "say" && f.text.includes(`← ${me.name}`) && Date.now() - f.t < TICK_MS * 3);
  const free = tasks.find((t) => t.status === "todo");
  const myTask = tasks.find((t) => t.id === me.taskId);
  const other = pick(employees.filter((o) => o.id !== me.id));

  if (recentToMe && Math.random() < 0.8) {
    const from = employees.find((o) => recentToMe.who === o.id);
    return { action: "talk", room: from?.room || me.room, talk_to: from?.id || "none", task_id: 0,
      activity: `يرد على ${from?.name || "زميل"}`, say: pick(LINES.reply), thought: "", mood: "🙂" };
  }
  if (me.energy < 35) {
    return { action: "break", room: pick(["kitchen", "lounge"]), talk_to: "none", task_id: 0,
      activity: "يأخذ استراحة", say: pick(LINES.break), thought: "تعبت شوي", mood: "😮‍💨" };
  }
  if (!myTask && free) {
    return { action: "pick_task", room: "desk", talk_to: "none", task_id: free.id,
      activity: `يبدأ: ${free.title}`, say: `آني آخذ "${free.title}"`, thought: "", mood: "💪" };
  }
  if (myTask && myTask.progress >= 90) {
    return { action: "finish_task", room: "desk", talk_to: "none", task_id: myTask.id,
      activity: `أنهى: ${myTask.title}`, say: "خلصت! 🎉", thought: "", mood: "🤩" };
  }
  const r = Math.random();
  if (r < 0.2) {
    return { action: "talk", room: other.room, talk_to: other.id, task_id: 0,
      activity: `يتكلم مع ${other.name}`, say: pick(LINES.talk), thought: "", mood: "😄" };
  }
  if (r < 0.27) {
    return { action: "meeting", room: "meeting", talk_to: "none", task_id: 0,
      activity: "في اجتماع", say: pick(LINES.meeting), thought: "", mood: "🧐" };
  }
  return { action: "work", room: "desk", talk_to: "none", task_id: myTask?.id || 0,
    activity: myTask ? `يشتغل على: ${myTask.title}` : "يرتب الإيميلات",
    say: Math.random() < 0.3 ? pick(LINES.work) : "", thought: "", mood: pick(["🙂", "😐", "🤓", "😌"]) };
}

// ---------------------------------------------------------------- تطبيق القرار
function apply(me, d) {
  me.room = ROOMS[d.room] ? d.room : me.room;
  me.activity = d.activity || me.activity;
  me.thought = d.thought || "";
  me.mood = d.mood || me.mood;
  me.say = d.say || "";
  const target = employees.find((o) => o.id === d.talk_to && o.id !== me.id);
  me.sayTo = target ? target.id : null;

  switch (d.action) {
    case "work": {
      me.energy = Math.max(0, me.energy - 6);
      const t = tasks.find((x) => x.id === me.taskId);
      if (t && t.status === "doing") t.progress = Math.min(100, t.progress + 10 + Math.floor(Math.random() * 15));
      break;
    }
    case "break":
      me.energy = Math.min(100, me.energy + 25);
      break;
    case "meeting":
      me.energy = Math.max(0, me.energy - 3);
      break;
    case "talk":
      me.energy = Math.max(0, me.energy - 2);
      if (target) remember(target, `${me.name} قال لي: "${d.say}"`);
      break;
    case "pick_task": {
      const t = tasks.find((x) => x.id === d.task_id && x.status === "todo");
      if (t && !me.taskId) {
        t.status = "doing"; t.owner = me.name; me.taskId = t.id;
        log("task", `${me.name} استلم المهمة #${t.id}: ${t.title}`, me.id);
      }
      break;
    }
    case "finish_task": {
      const t = tasks.find((x) => x.id === me.taskId);
      if (t) {
        t.status = "done"; t.progress = 100; me.taskId = null;
        log("done", `✅ ${me.name} أنهى المهمة #${t.id}: ${t.title}`, me.id);
      }
      break;
    }
  }

  remember(me, `${me.activity}${d.say ? ` وقلت: "${d.say}"` : ""}`);
  if (d.say) log("say", `${me.name}${target ? ` ← ${target.name}` : ""}: ${d.say}`, me.id);
  else log("act", `${me.name} ${me.activity}`, me.id);
}

// ---------------------------------------------------------------- الحلقة
let turn = 0;
let thinking = false;
async function tick() {
  if (thinking) return;
  thinking = true;
  clockMinutes += 5;
  // كل موظف يفقد كلامه القديم ليظهر الجديد فقط
  for (const e of employees) if (Math.random() < 0.5) { e.say = ""; e.sayTo = null; }
  // نختار الموظف الذي كُلّم مؤخراً أولاً، وإلا بالتناوب
  const addressed = employees.find((e) => employees.some((o) => o.sayTo === e.id) && e.busyUntil < Date.now());
  const me = addressed || employees[turn++ % employees.length];
  me.busyUntil = Date.now() + TICK_MS;
  broadcast("thinking", { id: me.id });
  try {
    const d = client ? await decideWithClaude(me) : decideLocally(me);
    apply(me, d);
  } catch (err) {
    console.error(`[${me.id}]`, err.message);
    apply(me, decideLocally(me));
  }
  broadcast("state", snapshot());
  thinking = false;
}

// ---------------------------------------------------------------- HTTP
function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
    for (const f of [...feed].reverse().slice(-30)) res.write(`event: feed\ndata: ${JSON.stringify(f)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/api/task" && req.method === "POST") {
    const { title } = await readBody(req);
    if (typeof title === "string" && title.trim()) {
      const t = { id: taskSeq++, title: title.trim().slice(0, 120), status: "todo", owner: null, progress: 0 };
      tasks.push(t);
      log("ceo", `📢 المدير أضاف مهمة جديدة #${t.id}: ${t.title}`);
      broadcast("state", snapshot());
    }
    res.writeHead(204).end();
    return;
  }
  if (url.pathname === "/api/announce" && req.method === "POST") {
    const { text } = await readBody(req);
    if (typeof text === "string" && text.trim()) {
      const msg = text.trim().slice(0, 200);
      for (const e of employees) remember(e, `المدير أعلن للجميع: "${msg}"`);
      log("ceo", `📢 المدير: ${msg}`);
    }
    res.writeHead(204).end();
    return;
  }
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const full = path.join(here, "public", path.normalize(file));
  if (!full.startsWith(path.join(here, "public")) || !fs.existsSync(full)) {
    res.writeHead(404).end("not found");
    return;
  }
  const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" }[path.extname(full)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, () => {
  console.log(`🏢 مقر الشركة الحي يعمل على http://localhost:${PORT}`);
  console.log(client ? `🧠 الوضع: Claude (${MODEL})` : "🎭 الوضع: محاكاة محلية (ضع ANTHROPIC_API_KEY لتشغيل Claude)");
  log("act", "بدأ يوم العمل في شركة النهرين ☀️");
  setInterval(tick, TICK_MS);
});
