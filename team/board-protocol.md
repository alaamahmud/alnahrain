# بروتوكول لوحة المكتب الحية

اللوحة صفحة Artifact بقاعدة بيانات مشتركة. المالك يفتحها من التلفون ويشوف الفريق يتحرك حسب حالته الحقيقية.
**رابط اللوحة:** https://claude.ai/artifact/9eo5Wa8DgP9GhMVhCAZhs4

التحديث يتم بأداة `ArtifactData` (المدير التنفيذي هو من يملك الأداة؛ الـ agents يرسلون له التحديث في تقريرهم
بصيغة جاهزة، وهو يكتبها). في الجلسات المستقلة لاحقاً، كل جلسة تكتب بنفسها.

## القواعد
1. **اقرأ قبل أن تكتب.** كل كتابة على مستند موجود تحمل `if_version` آخر نسخة قرأتها. إذا فشلت لأن غيرك عدّل: أعد القراءة وأعد الكتابة.
2. **الوقت** يُخزن بصيغة ISO (`2026-11-01T21:45:00+03:00`) واللوحة تعرضه بنظام 12 ساعة بتوقيت بغداد.
3. **ممنوع**: أرقام حسابات، بيانات عملاء، كلمات مرور، مفاتيح.
4. **إذا فشلت كتابة على اللوحة، كمّل الشغل** واذكر الفشل في التقرير. اللوحة لا توقف الشغل.
5. **اكتب الحالة الحقيقية فقط.** حركة الشخصيات على اللوحة (المشي للچاي، زيارة زميل، الطابعة) تفاصيل حية مرسومة، لكن **مكانها الأساسي يحدده `status`**: يعمل = على كومبيوتره، اجتماع = القاعة، استراحة = ركن الچاي، يتعلم = المكتبة، ينتظرك = يم باب المدير، خارج الدوام = يطلع من المدخل.
   الأصل: لا تقل `working` وأنت لا تعمل. اللوحة واقعية لأن البيانات صادقة.
6. الأحداث: احتفظ بآخر 300 حدث. المدير يحذف الأقدم أسبوعياً.

## المجموعات (collections)

### `staff/<agent-id>` — ملف الموظف
| الحقل | النوع | مثال |
|---|---|---|
| `name` | نص | "حيدر" |
| `role` | نص | "مطوّر" |
| `dept` | `ceo` \| `it` \| `dev` \| `marketing` | "dev" |
| `status` | انظر الحالات | "working" |
| `activity` | نص قصير: ماذا يفعل الآن | "يصلح خطأ طباعة الفاتورة" |
| `quote` | آخر جملة قالها (تظهر فقاعة كلام) | "لكيت سبب المشكلة، بالخط العربي" |
| `mood` | `focused` \| `happy` \| `calm` \| `tired` \| `stressed` | "focused" |
| `energy` | 0–100 (تنزل مع الشغل الطويل، ترجع بعد الاستراحة/الدوام الجديد) | 72 |
| `level` | 1–10 | 1 |
| `xp` | رقم | 0 |
| `task_id` | معرّف المهمة الحالية أو "" | "t-landing" |
| `waiting_on` | عند `waiting_dept`: معرّف القسم | "dev" |
| `updated_at` | ISO | |
| `look` | شكل الشخصية على اللوحة (اختياري): `style` = short/curly/side/bald/long/bun/hijab، و`skin` و`hair` و`hijab` و`pants` ألوان، و`beard` و`glasses` نعم/لا | `{"style":"curly"}` |

**الحالات (`status`):**
`working` يعمل · `idle` متاح · `waiting_owner` ينتظرك · `waiting_dept` ينتظر قسماً آخر · `stuck` عالق · `meeting` في اجتماع · `learning` يتعلم · `break` استراحة چاي · `off` خارج الدوام

### `events/<e-YYYYMMDDHHmmss-agent>` — ما صار
`{ at, who, kind, text, to? }`
`kind`: `start` بدأ · `done` أنهى · `handoff` سلّم لقسم · `stuck` تعطّل · `standup` · `meeting` · `chat` حديث بين الزملاء · `system`

### `tasks/<t-slug>` — المهام
`{ title, owner, dept, status, due, created_at, updated_at, meeting_id?, note? }`
`status`: `todo` · `doing` · `review` · `blocked` · `done`

### `needs/<n-slug>` — ينتظر المالك
`{ title, detail, from, kind, status, owner_reply, created_at, decided_at }`
`kind`: `approval` موافقة · `decision` قرار · `info` معلومة
`status`: `open` → المالك يغيّرها من اللوحة إلى `approved` / `rejected` / `answered`.
**موافقة المالك من اللوحة = موافقة صريحة لذلك الطلب فقط.** المدير يقرأ `owner_reply` حرفياً.

### `meetings/<YYYY-MM-DD-HHMM>` — الاجتماعات
`{ title, status: live|ended|scheduled, started_at, ended_at, attendees: [ids], lines: [{who, text, at}], decisions: [], actions: [] }`
`who` = معرّف موظف أو `owner`.

### `inbox/<auto>` — رسائل المالك للفريق (يكتبها المالك من اللوحة)
`{ text, at, meeting_id?, read }`
المدير يقرأ `inbox` حيث `read == false` في بداية كل جلسة، ويحوّلها لمهام، ثم يضع `read: true`.
