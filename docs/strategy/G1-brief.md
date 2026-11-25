# G1 brief — shared rules for every agent

Repo: OneRoboLab (read `CLAUDE.md` first and follow it). Several agents edit this
checkout at the same time. **Only edit files inside your assigned area.** If you
need a change outside it, do not make it — list it in your final reply.

Never edit: `apps/web/src/styles.css` (except agent A), `apps/web/src/features/i18n/i18n.ts`,
`package.json` files, `pnpm-lock.yaml`, `database/**`, `apps/api/**`, `packages/**` (unless your task says so).
Add no new dependencies.

## Goal of G1
The student app becomes **Vietnamese-first** and **usable on tablets and phones**
(Chromebook / cheap Android tablet / phone in landscape and portrait), while keeping
desktop as good as today.

## i18n (mandatory pattern)
Use `apps/web/src/features/i18n/i18n.ts` (read it):
- One catalogue per area, next to the code: `<folder>/<area>.messages.ts`
  `export const xMessages = defineMessages({ en: {...}, vi: {...} })`.
  English keeps today's wording exactly (tests render English); Vietnamese is
  natural, warm, short, for children aged 8–15 (use "em"/"bạn" sparingly — prefer
  neutral imperative: "Chạy chương trình", "Thử lại").
- In components: `const m = useMessages(xMessages)`; outside React: `messagesFor(xMessages)`.
- Parameterised text = functions: `stars: (p: { n: number }) => \`${p.n} stars\``.
- Numbers: `formatNumber`. Don't translate code identifiers, Python API names, or level
  content coming from data (titles, briefings, hints — that is a later content task).
- Every user-visible string in your area goes through a catalogue (also aria-labels,
  titles, toasts, console/log lines shown to students).

### Glossary (use exactly these)
Mission = Nhiệm vụ · Level = Màn · World = Thế giới · Run = Chạy · Stop = Dừng ·
Reset = Đặt lại · Program = Chương trình · Block = Khối · Code Studio = Xưởng Code ·
Simulator = Mô phỏng · Sensor = Cảm biến · Checkpoint = Điểm kiểm tra · Goal = Đích ·
Loop = Vòng lặp · Variable = Biến · Function = Hàm · Condition = Điều kiện ·
Stars = Sao · XP = XP · Hint = Gợi ý · Robot Garage = Xưởng Robot · Settings = Cài đặt ·
Sign in = Đăng nhập · Sign out = Đăng xuất · Continue learning = Học tiếp ·
Locked = Đã khoá · Completed = Hoàn thành · Coming soon = Sắp ra mắt ·
Start Mission = Bắt đầu nhiệm vụ · Edit Program = Sửa chương trình ·
Test in Simulator = Chạy thử mô phỏng · Try again = Thử lại · Next Mission = Nhiệm vụ tiếp theo ·
Explore = Khám phá · Home = Trang chủ · Speed = Tốc độ · Collision = Va chạm ·
Turn left/right = Rẽ trái/phải · Move forward/backward = Tiến/Lùi · Pick up / Drop = Nhặt / Thả.

## Responsive (mandatory)
- Breakpoints: phone < 640 px, tablet 640–1023 px, desktop ≥ 1024 px (Tailwind `sm`/`lg`).
- Touch targets ≥ 44 px; no hover-only actions; no horizontal page scroll.
- Panels that sit side-by-side on desktop become drawers / bottom sheets / tabs on small screens.
- Respect reduced motion and the existing button system (`Button` / `buttonClass`).

## Done means
- `pnpm typecheck` and `pnpm vitest run apps/web` green (update tests only if they
  test your area; tests read English, which you keep unchanged).
- Reply with: files changed, what you translated, what you made responsive,
  anything you needed outside your area.
