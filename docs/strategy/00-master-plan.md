# OneRoboLab 2027 — Kế hoạch tổng thể

> Bản tổng hợp của "Giám đốc" Claude từ 3 báo cáo bộ phận, ngày 26/11/2026:
> - [01 — Nghiên cứu thị trường](01-market-research.md) (Antigravity / Gemini 4 Neon)
> - [02 — Định hướng 3D](02-3d-design-direction.md) (Codex / GPT-6 Luna)
> - [03 — Đánh giá kỹ thuật](03-tech-audit.md) (Claude CTO)
>
> Số liệu thị trường và các văn bản pháp lý (số Thông tư, Quyết định, Luật) do agent nghiên cứu tổng hợp từ web — **phải kiểm chứng lại với nguồn gốc trước khi đưa vào hồ sơ gọi vốn hay làm việc với Sở GD**. Mọi con số tài chính là *ước tính*.

---

## 0. Tóm tắt 1 trang

**Ý tưởng đột phá:** Không làm "thêm một game học code". Làm **giải đấu robot lập trình quốc gia đầu tiên không cần mua robot** — và sản phẩm học là nơi luyện quân cho giải đấu đó.

> **OneRoboLab = "Sân tập + Giải đấu + Gia sư AI" cho robot lập trình.**
> Học sinh 8–15 tuổi học lập trình bằng cách huấn luyện robot của chính mình trong thế giới 3D, mang robot đi thi đấu với cả nước, và cùng một chương trình đó chạy được trên robot thật giá 500k.

Vì sao thắng:

| CodeCombat & đối thủ | OneRoboLab |
|---|---|
| Hiệp sĩ đánh quái 2D — phụ huynh VN khó thấy giá trị thực | Robot tự hành có cảm biến — "kỹ sư nhí", nạp được ra robot thật |
| Học một mình, giải đấu là phụ | **Giải đấu là động cơ chính**: mùa giải, bảng xếp hạng trường/tỉnh, chung kết esports |
| ~2,5tr/năm/1 tài khoản, không bám GDPT 2018 | 1,19tr/năm, Family 3 con 1,89tr, gói trường 90k/HS, giáo án GDPT 2018 |
| Hint tĩnh | **Gia sư AI tiếng Việt** đọc được code + những gì robot "thấy" trong 3D, hỏi ngược chứ không đưa đáp án |
| Báo cáo qua email | **Clip 15 giây robot của con gửi qua Zalo** mỗi tuần |
| Giải robot thật: 25–75tr/đội → ~vài trăm đội cả nước | Vòng loại online 0đ → mục tiêu hàng chục nghìn thí sinh |

**Quyết định build:** *Giữ lõi, đập vỏ.* Giữ engine mô phỏng tất định, compiler/IR, editor khối, chương trình 24 nhiệm vụ và backend bảo mật (~10–12k dòng giá trị nhất). Viết lại toàn bộ lớp ứng dụng: mobile/tablet-first, tiếng Việt, thi đấu, lớp học, AI, thanh toán.

**Mốc lớn:**
- **T3/2027** — Pilot 20 trường + 5 trung tâm STEM.
- **T8/2027** — Ra mắt thương mại dịp tựu trường.
- **T10/2027–T1/2028** — Giải Robotics Ảo Quốc gia Mùa 1.

**Năm 1 (ước tính):** 120k người dùng, ~45k thí sinh giải, ~7,5 tỷ doanh thu. **Năm 3:** 1,2 triệu người dùng, ~92 tỷ, mở rộng SEA.

---

## 1. Chiến lược sản phẩm

### 1.1 Định vị
- **Cho ai:** học sinh lớp 3–9 (8–15 tuổi), phụ huynh thành thị trả tiền, giáo viên Tin học là người lan toả.
- **Thay thế cái gì:** lớp code/robot offline 12–36tr/năm và bộ kit robot 15–32tr.
- **Lời hứa với phụ huynh:** "Con chơi như game, nhưng thứ con học là lập trình thật (Python), robot thật, thi đấu thật — và mẹ thấy tiến bộ mỗi tuần trên Zalo."
- **Lời hứa với trường:** "Dạy Tin học GDPT 2018 + thí điểm AI không cần mua thiết bị, chạy trên phòng máy cũ, chấm bài tự động."

### 1.2 Vòng lặp lõi (core loop)

```
  HỌC ──► HUẤN LUYỆN ──► THI ĐẤU ──► KHOE
 (nhiệm vụ)  (robot của em,   (giải tuần,     (clip replay
             nâng cấp,        mùa giải,       Zalo/TikTok,
             code riêng)      chung kết)      huy hiệu)
   ▲                                             │
   └──────── Gia sư AI "Mầm" đi cùng ◄───────────┘
```

Mỗi phiên 15–25 phút: 2–3 nhiệm vụ → mở khoá một linh kiện hoặc kỹ năng → thử ngay trong **Thử thách tuần** (đua thời gian với "bóng ma" replay của bạn bè) → nhận clip.

### 1.3 Bốn trụ cột

| Trụ cột | Nội dung | Ai trả tiền |
|---|---|---|
| **LEARN — Học** | 8 thế giới, ~200 nhiệm vụ, Blocks → Python (song song) → Python thật; World AI Robotics | Phụ huynh (Pro/Family) |
| **COMPETE — Thi** | Thử thách tuần, đấu bot 1v1/2v2, mùa giải, Giải Quốc gia, Arena livestream | Battle Pass, nhà tài trợ |
| **TEACH — Dạy** | Lớp, bài tập, sổ điểm, giáo án GDPT 2018, tổ chức giải cấp trường trong 15 phút | Trường, trung tâm |
| **MAKE — Tạo** | Garage robot, trình tạo map, nạp code ra robot thật (Yolo:Bit / micro:bit / ESP32) | Combo phần cứng, trường Premium |

### 1.4 Những thứ KHÔNG làm (để giữ tập trung)
- Không làm app native iOS/Android năm đầu: web/PWA, tránh phí store 15–30%.
- Không bán vật phẩm tăng sức mạnh hay vật phẩm giao dịch được. Mỹ phẩm robot chỉ mở bằng tiến độ học, để không thành pay-to-win và tránh rủi ro bị xếp vào diện giấy phép game.
- Không ép trường thi đua, không lấy kết quả giải để xét thi đua (bài học VioEdu 2026).
- Không làm vật lý 3D phức tạp kiểu mô phỏng công nghiệp. Mô phỏng 2D tất định + hình ảnh 3D là đủ và là lợi thế (chấm công bằng).

---

## 2. Tính năng — ưu tiên theo giai đoạn

Thang ưu tiên: **P0** = phải có để pilot · **P1** = phải có để ra mắt thương mại · **P2** = sau ra mắt.

### LEARN
| Tính năng | Ưu tiên | Ghi chú |
|---|---|---|
| Tiếng Việt toàn bộ (i18n, VI trước, EN sau) | P0 | Hiện 100% tiếng Anh hard-code |
| Editor khối dùng tốt trên tablet/cảm ứng | P0 | 72% hộ không có PC |
| Chế độ Split Blocks ⇄ Python | P0 | Đã có lõi |
| "Đoán trước – Chạy – Kiểm chứng" (PREDICT) mỗi nhiệm vụ | P0 | Đã có trong briefing, đưa lên UI chính |
| Hologram đường đi trước khi chạy + Sensor X-ray | P0 | Wow #1, #2 (Luna) |
| Replay "Vì sao robot kẹt?" có dòng thời gian theo khối lệnh | P1 | Wow #3 |
| 3 thế giới / ~75 nhiệm vụ cho pilot → 8 thế giới / ~200 nhiệm vụ | P0 → P2 | Xem §3 |
| Python thật trong sandbox (Pyodide/VM) cho lớp 7+ | P2 | Hiện là Python subset → khối |
| World "AI Robotics": huấn luyện phân loại ảnh đơn giản cho camera robot | P2 | Đón đầu thí điểm giáo dục AI |

### COMPETE
| Tính năng | Ưu tiên | Ghi chú |
|---|---|---|
| **Server chấm bằng replay** (chống gian lận) | P0 | Nền móng của mọi thứ thi đấu |
| Thử thách tuần: đua thời gian, bảng xếp hạng lớp/trường/tỉnh, ghost replay | P0 | Không cần realtime |
| Đấu bot 1v1 (2 chương trình cùng sân, server mô phỏng, client xem replay) | P1 | Xem §5 — không cần netcode |
| Mùa giải, xếp hạng Elo, huy hiệu số xác thực | P1 | |
| Arena: camera kiểu truyền hình, overlay livestream, "đạo diễn" camera tự động | P1 | Cho chung kết |
| Chế độ thi có giám sát (proctored), phòng thi theo lịch | P1 | Vòng khu vực |
| 2v2 liên minh, Vua đồi, Battle Royale | P2 | |

### TEACH
| Tính năng | Ưu tiên | Ghi chú |
|---|---|---|
| Trường / lớp / mã tham gia / vai trò giáo viên | P0 | Chưa có bảng nào |
| Giao bài, hạn nộp, sổ điểm, xuất Excel | P0 | |
| Màn hình "lớp đang học" realtime (ai kẹt ở đâu) | P1 | |
| Giáo án 35 tiết bám GDPT 2018 + khung năng lực số | P1 | Cần giáo viên thật biên soạn |
| Import học sinh CSV, tài khoản không cần email (mã + ảnh) | P0 | Học sinh tiểu học không có email |
| Tổ chức giải cấp trường bằng 1 nút | P1 | Kênh lan toả mạnh nhất |

### MAKE
| Tính năng | Ưu tiên | Ghi chú |
|---|---|---|
| Garage robot (đã có) + lưu lên server | P1 | Hiện chỉ localStorage |
| Robot đồng hành "Mầm" có biểu cảm | P0 | Nhân vật thương hiệu |
| Trình tạo map kéo-thả (giáo viên trước, học sinh sau) | P2 | Cần level dạng JSON (§6) |
| Nạp MicroPython ra Yolo:Bit / micro:bit / ESP32 qua WebSerial/WebBluetooth | P2 | Cần đối tác phần cứng |
| Digital twin sân WRO/VEX-style | P2 | Cộng đồng STEM "cứng" |

### Nền tảng & doanh thu
| Tính năng | Ưu tiên | Ghi chú |
|---|---|---|
| Gia sư AI "Mầm" (§4) | P0 bản cơ bản, P1 đầy đủ | |
| Zalo: OA + ZNS gửi báo cáo tuần + clip 15s | P1 | Wow có ROI cao nhất |
| Tài khoản phụ huynh + cơ chế đồng ý cho trẻ dưới 16 | P0 | Pháp lý bắt buộc |
| Thanh toán VietQR / VNPay / MoMo, gói Pro / Family / School | P1 | |
| Analytics học tập + phễu (tự host) | P0 | Hiện bị vứt bỏ ở production |
| PWA, offline-tolerant, chế độ máy yếu | P0 | |

---

## 3. Chương trình học

Ghép lộ trình 8 thế giới của Luna với kỹ năng và lớp học:

| # | Thế giới (tên tạm) | Kỹ năng | Lớp gợi ý | Dạng code | Số nhiệm vụ |
|---|---|---|---|---|---|
| 1 | Xưởng Sân Nắng | Tuần tự, di chuyển, quay | 3–4 | Khối | 24 (tái dùng Starter Island) |
| 2 | Vịnh Mây Cong | Cảm biến khoảng cách, tránh vật cản | 3–5 | Khối | 25 |
| 3 | Phố Đèn Gió | Sự kiện, thời gian, đèn giao thông | 4–5 | Khối + xem Python | 25 |
| 4 | Ruộng Bậc Thang Mạch Nước | Vòng lặp, mẫu lặp, toạ độ | 4–6 | Split | 25 |
| 5 | Rừng Mưa Thì Thầm | Điều kiện lồng nhau, rẽ nhánh | 5–7 | Split | 25 |
| 6 | Sài Gòn Kênh Tương Lai | Hàm, biến, lập kế hoạch đường đi | 6–8 | Python trước | 25 |
| 7 | Cao Nguyên Gió Máy | Hiệu chỉnh, nhiều cảm biến, danh sách | 7–9 | Python | 25 |
| 8 | Quỹ Đạo Xưởng Mở | Dự án cuối, nhiều robot phối hợp | 8–9 | Python thật | 20 + dự án |
| + | Phòng thí nghiệm AI | Dữ liệu, phân loại, robot "nhìn" | 6–9 | Khối AI + Python | 15 |

Nguyên tắc sư phạm:
- Mỗi nhiệm vụ đi theo nhịp **Đoán → Viết → Chạy → Sửa → Giải thích**.
- Mỗi thế giới kết thúc bằng một **Thử thách trùm** có nhiều layout ngẫu nhiên có seed, để học sinh không học thuộc đáp án.
- Mỗi khái niệm có ít nhất 3 nhiệm vụ: giới thiệu, luyện, biến thể.
- Đánh giá năng lực (mastery) theo từng khái niệm, không theo số sao. Giáo viên và phụ huynh xem bản đồ kỹ năng.

Nhân sự: cần **1 trưởng nhóm sư phạm là giáo viên Tin học thật** (bắt buộc, không thay bằng AI) để duyệt độ khó và soạn giáo án GDPT 2018.

---

## 4. Gia sư AI "Mầm"

**Mầm nhận được:**
- chương trình của học sinh (IR + blockId), lỗi biên dịch;
- event log của lần chạy (va chạm, giá trị cảm biến, mục tiêu đạt/chưa đạt);
- mục tiêu nhiệm vụ, khái niệm đang học, tầng hint hiện tại.

**Mầm làm:**
- Hỏi ngược kiểu Socratic ("Robot dừng trước tường 2 ô — em nghĩ cảm biến đọc được bao nhiêu lúc đó?").
- Chỉ vào đúng khối gây lỗi: highlight trên canvas + nhảy tới thời điểm đó trong replay.
- Giải thích bằng tiếng Việt phù hợp lứa tuổi.

**Guardrails:**
- **Không bao giờ đưa lời giải đầy đủ.** Tầng hint 4 (lời giải) vẫn là hint trả phí hiện có, không do AI sinh.
- Chỉ nói về nhiệm vụ: bộ lọc chủ đề, từ chối nội dung ngoài lề, không thu thập thông tin cá nhân của trẻ.
- Không gửi tên hay email của trẻ cho nhà cung cấp LLM, chỉ gửi ngữ cảnh kỹ thuật.
- Giới hạn lượt dùng: Free 5 lượt/ngày, Pro fair-use. Có log để giáo viên/phụ huynh xem lại.

**Kỹ thuật:**
- Model chi phí thấp cho hội thoại thường (Claude Haiku 5.5 hoặc tương đương), model mạnh hơn cho phân tích replay khó.
- Prompt caching cho phần ngữ cảnh nhiệm vụ.
- Mục tiêu chi phí ≤ 30–45k đ/HS trả phí/năm (ước tính của bộ phận nghiên cứu, cần đo thật trong pilot).

**Đánh giá chất lượng:** bộ 200 tình huống "học sinh kẹt" thật từ pilot. Chấm 3 tiêu chí: có lộ đáp án không, có đúng lỗi không, có hợp lứa tuổi không. Chạy lại mỗi khi đổi prompt hay đổi model.

---

## 5. Hệ thống thi đấu

### 5.1 Ý tưởng kỹ thuật then chốt: thi đấu không cần netcode
Mô phỏng là tất định: cùng chương trình + cùng seed + cùng phiên bản thì luôn ra cùng kết quả. Do đó:
1. Thí sinh **nộp chương trình**, không gửi kết quả.
2. **Server mô phỏng** (worker headless) và ra kết quả chính thức + file replay.
3. "Trực tiếp" = mọi người xem cùng một replay đồng bộ thời gian qua WebSocket, có bình luận viên và camera đạo diễn.

Hệ quả: chống gian lận gần như tuyệt đối, chi phí server thấp (một trận bot chỉ vài giây CPU), chịu được mạng trường yếu. Đấu 1v1 = 2 chương trình cùng một sân trong cùng một lần mô phỏng.

### 5.2 Thể thức
| Thể thức | Mô tả | Khi nào |
|---|---|---|
| Thử thách tuần | Mỗi thứ 2 một map mới, đua thời gian/điểm, ghost của bạn bè | Quanh năm, P0 |
| Đấu bot xếp hạng | 1v1 tranh khối năng lượng/đẩy thùng, Elo, nộp lại code không giới hạn | P1 |
| Giải trường | Giáo viên tạo bằng 1 nút, bảng đấu tự sinh | P1 |
| **Giải Robotics Ảo Quốc gia (tên tạm VVRC)** | Sơ loại online miễn phí 4 tuần → Khu vực online có giám sát → Chung kết onsite Top 100, livestream esports + hạng mục robot thật | Mùa 1: T10/2027–T1/2028 |

### 5.3 Đối tác và pháp lý giải đấu
- **Đồng tổ chức** với một đơn vị uy tín: Hội Tin học, một ĐH CNTT lớn, hoặc STEAM for Vietnam.
- **Nhà tài trợ:** ngân hàng, viễn thông, công ty công nghệ (100tr–1,5 tỷ/mùa). Logo xuất hiện trên sân 3D.
- **Nguyên tắc:** tham gia tự nguyện, vòng loại miễn phí, không xếp hạng trường để "thi đua", có cơ chế đồng ý của phụ huynh.

---

## 6. Kiến trúc kỹ thuật mới

### 6.1 Sơ đồ
```
 Trình duyệt (PWA, React, R3F/WebGL2)
   ├─ App học sinh (mobile/tablet-first, i18n)
   ├─ App giáo viên ─┐
   ├─ App phụ huynh ─┤ (cùng codebase, khác vai trò)
   ├─ Arena viewer (xem trực tiếp/replay)
   └─ Admin (giữ nguyên, nội bộ)
          │ HTTPS / WebSocket
 ┌────────▼──────────────────────────────────────────────┐
 │ API (Fastify 5, giữ)  │ Realtime (WS rooms, mới)       │
 │  auth, catalog, lớp,  │  phát replay đồng bộ, chat     │
 │  bài tập, thanh toán  │  bình luận, lớp học trực tiếp  │
 ├───────────────────────┴───────────────────────────────┤
 │ Judge workers (Node, chạy @robolab/simulation headless)│ ◄─ hàng đợi
 │ AI Tutor service (gọi LLM, lọc, ghi log)               │
 │ Notifier (Zalo ZNS, email)                             │
 └───────────────┬───────────────────────────────────────┘
   PostgreSQL (giữ schema + mở rộng) · Redis (queue, leaderboard)
   Object storage + CDN (replay, asset GLB/KTX2)
```

### 6.2 Giữ / chuyển / mới
| Hạng mục | Quyết định |
|---|---|
| `packages/*-engine`, `shared` | **Giữ** |
| `SimulationRuntime`, `RobotRuntime`, compiler | **Chuyển** vào `packages/simulation` và `packages/compiler` để chạy được trên server |
| Level (đang là code TS) | **Chuyển** sang JSON có schema + version. Cả editor lẫn judge đều đọc JSON |
| Công thức điểm (đang trùng web/api) | **Gộp** về một package |
| Vỏ app web (`App.tsx` ép min-width 1024px, layout desktop) | **Viết lại**: mobile/tablet-first, design system mới theo palette của Luna |
| API, schema, auth, ledger XP | **Giữ** + thêm: tổ chức/trường, lớp, bài tập, phụ huynh, đồng ý, gói/thanh toán, giải đấu/trận/replay |
| Admin console | **Giữ** |
| Realtime, judge, AI tutor, notifier, payments | **Mới** |
| Analytics | **Mới**, tự host. Cần sửa quy tắc trong CLAUDE.md đang cấm dịch vụ ngoài |

### 6.3 Hiệu năng (từ Luna, cần đo thật)
- WebGL2 là nền tảng chính, WebGPU chỉ là nâng cấp tuỳ chọn.
- **Máy yếu:** ≤100 lệnh vẽ, ≤60k tam giác, ≤96 MB texture. Tối thiểu 30 FPS ổn định, 60 FPS ở scene nhẹ.
- **Thời gian tải:** khung app < 2 giây; màn chơi đầu < 5 giây khi cold start trên mạng trường.
- **Phòng thiết bị đo chuẩn** (việc làm ngay): 1 PC phòng máy trường công cũ, 1 laptop iGPU, 1 Android 3–4 triệu, 1 tablet Android rẻ.

---

## 7. Định hướng hình ảnh 3D (tóm tắt từ Luna)
- **Phong cách:** "Bright Workshop Diorama" — low-poly bo mềm, sáng ấm, emissive tiết chế. Neon chỉ dùng cho Arena.
- **Bảng màu:** Ink Navy `#17324D`, Workshop Teal `#12A6A1`, Signal Coral `#F26B5B`, Sun Mango `#FFC857`, Leaf Green `#68B86B`, Sky Mist `#DCEFF2`, Paper Sand `#F2E7D2`, Plum Shade `#665080`.
- **Robot "Mầm":** thân capsule, đầu cảm biến lớn, mắt LED glyph, anten lệch làm dấu nhận diện.
- **8 thế giới** gợi cảm hứng Việt Nam nhưng hư cấu, không tái dựng danh thắng.
- **Pipeline:** Blender → GLB → KTX2 + Meshopt → asset registry, có LOD, bake ánh sáng.
- **Chi phí art:** ~28–45 người-tuần cho 8 thế giới + Arena (chưa gồm engineering).
- **Việc đầu tiên:** 1 *vertical slice* (Xưởng Sân Nắng + Mầm + garage showroom) để khoá chất lượng trước khi làm hàng loạt.

---

## 8. Mô hình kinh doanh (từ bộ phận nghiên cứu, cần kiểm chứng bằng pilot)

| Gói | Giá | Ghi chú |
|---|---|---|
| Free | 0đ | World 1, 5 lượt AI/ngày, vòng loại giải miễn phí |
| Pro tháng | 149.000đ | Làm giá neo |
| **Pro năm** | **1.190.000đ** | Gói chủ lực |
| **Family năm (3 con)** | **1.890.000đ** | Vũ khí khác biệt |
| Trường công | ~90.000đ/HS/năm | Kèm giáo án, dashboard |
| Trường tư / quốc tế | 250–450k/HS/năm | Song ngữ, đào tạo giáo viên |
| Trung tâm STEM | 250k/học viên/năm (tối thiểu 25tr) | Kênh tiền nhanh năm 1 |
| Battle Pass mùa giải | 99–199k/mùa | Map luyện, phân tích replay |
| Tài trợ giải | 100tr–1,5 tỷ/mùa | Nuôi chi phí chung kết |

Điều chỉnh của Giám đốc:
- Năm 1 **ưu tiên trung tâm STEM + trường tư** vì tiền về nhanh và chu kỳ bán ngắn. Trường công dùng gói miễn phí 1 học kỳ để vào, chỉ thu tiền từ năm học 2028.
- Dự phóng 7,5 tỷ năm 1 phụ thuộc mạnh vào tài trợ (~2,8 tỷ). Nếu chưa ký được nhà tài trợ trước T8/2027, kế hoạch cơ sở tính doanh thu năm 1 chỉ **~4–5 tỷ**.

---

## 9. Go-to-market 2027

| Thời gian | Hoạt động |
|---|---|
| T12/2026–T2/2027 | Tuyển 20 trường + 5 trung tâm pilot (Hà Nội, TP.HCM, Đà Nẵng). Lập cộng đồng "Giáo viên Tin học & STEM" trên Facebook/Zalo. Tìm đối tác đồng tổ chức giải |
| T3–T5/2027 | Pilot ~3.000–10.000 học sinh. Đo W4 retention, FPS trên phòng máy, chất lượng AI. Thử thách tuần chạy nội bộ pilot |
| T5–T7/2027 | Chốt ngân sách trường cho năm học mới. Ký 1–2 nhà tài trợ. Chiến dịch KOC "mẹ nuôi con thông minh" + giáo viên |
| **T8–T9/2027** | **Ra mắt thương mại** (tựu trường): Pro/Family, Zalo OA, thanh toán |
| T10/2027–T1/2028 | **Giải Quốc gia Mùa 1**: sơ loại online → khu vực → chung kết onsite + livestream TikTok/YouTube |
| 2028 | Digital twin, nạp code robot thật, trình tạo map. Làm việc với 15–20 Sở GD. Mùa 2 |
| 2029 | Mở rộng SEA (Singapore cao cấp, Indonesia/Thái Lan đại trà) |

**Kênh chuyển đổi chính:** TikTok/Facebook (đầu phễu) → chơi thử 3 phút không cần đăng ký → Zalo OA (báo cáo + clip) → quét VietQR.

---

## 10. Tổ chức: "Công ty agent" + con người

### 10.1 Bộ máy AI (cách mình vận hành từ nay)
| Vai | Model | Việc |
|---|---|---|
| Giám đốc sản phẩm / Kiến trúc trưởng | Claude Opus 5.5 (Pro) | Kế hoạch, kiến trúc, chia việc, review cuối, code lõi (engine, judge, API) |
| Kỹ sư triển khai | Claude Sonnet 5.5 (subagent) | Code tính năng theo spec, test |
| Art Director / 3D engineer | GPT-6 Luna (Codex Go — dùng tiết kiệm) | Scene 3D, robot Mầm, Arena, shader, tối ưu render |
| Nghiên cứu / Tăng trưởng / Nội dung | Gemini 4 (Antigravity Pro) | Thị trường, đối thủ, pháp lý, nội dung marketing, bản dịch, giáo án nháp |
| QA chéo | Model khác với model đã viết | Mỗi PR lớn được một model khác review |

Quy trình: mỗi giai đoạn trong roadmap là một gói việc. Claude chia việc, các agent làm trên worktree riêng, review chéo, chạy `pnpm check`, rồi **dừng lại cho bạn duyệt** cuối mỗi giai đoạn (đúng quy tắc trong CLAUDE.md).

### 10.2 Con người bắt buộc phải có (AI không thay được)
| Vai | Khi nào | Vì sao |
|---|---|---|
| Founder / CEO (bạn) | Ngay | Quyết định, đối tác, gọi vốn |
| Trưởng nhóm sư phạm (giáo viên Tin học) | T12/2026 | Độ khó, giáo án GDPT 2018, uy tín với trường |
| Phát triển kinh doanh trường học / trung tâm | T1/2027 | Pilot, hợp đồng B2B, Sở GD |
| 3D artist (part-time / freelance) | T1/2027 | Polish robot Mầm và các thế giới. AI tạo nền, người hoàn thiện |
| Tư vấn pháp lý (dữ liệu trẻ em, thanh toán, giải đấu) | T1/2027 | Rủi ro sống còn |
| Cộng đồng / nội dung TikTok | T5/2027 | Kênh tăng trưởng |

**Chi phí năm 1 (ước tính thô):** đội 5–7 người tại VN + hạ tầng + AI + marketing + chung kết ≈ **4–7 tỷ đồng**. Chung kết onsite cần tài trợ bù.

---

## 11. Lộ trình kỹ thuật theo giai đoạn
Mỗi giai đoạn kết thúc bằng một lần duyệt.

| Giai đoạn | Thời gian | Nội dung | Tiêu chí xong |
|---|---|---|---|
| **G0 — Nền móng** | T12/2026 (4 tuần) | Chuyển runtime + compiler + level JSON vào packages. Judge headless trên server. Gộp công thức điểm. Phòng đo thiết bị | Server chấm lại 24 nhiệm vụ khớp 100% với client; test xanh |
| **G1 — Vỏ mới + tiếng Việt** | T1/2027 (4–5 tuần) | Design system mới, shell mobile/tablet-first, i18n VI, editor khối cảm ứng, robot Mầm v1, vertical slice World 1 | Chạy được trên tablet Android rẻ; máy yếu ≥30 FPS |
| **G2 — Lớp học + Phụ huynh** | T2/2027 (4 tuần) | Trường/lớp/giáo viên, tài khoản không email, giao bài, sổ điểm, phụ huynh + đồng ý, analytics | Giáo viên tạo lớp và giao bài trong < 5 phút |
| **G3 — AI + Thử thách tuần** | T3/2027 (4 tuần) | Mầm AI v1, bộ đánh giá AI, Thử thách tuần + bảng xếp hạng + ghost, hologram/X-ray | **Bắt đầu pilot** |
| **G4 — Nội dung + Thương mại** | T4–T7/2027 | World 2–3 (~75 nhiệm vụ), thanh toán, Zalo OA/ZNS + clip 15s, replay "vì sao kẹt" | **Ra mắt thương mại T8** |
| **G5 — Đấu trường** | T7–T9/2027 | Đấu bot 1v1, Elo, realtime xem trực tiếp, Arena + camera đạo diễn, phòng thi giám sát, chịu tải | Stress test 10k bài nộp/giờ. **Mở giải T10** |
| **G6 — Mở rộng** | 2028 | World 4–8, Python thật, trình tạo map, robot thật, digital twin, World AI | |

---

## 12. KPI cần theo dõi từ ngày đầu pilot
- **Học:** tỷ lệ hoàn thành World 1, thời gian tới "lần chạy thành công đầu tiên" (< 3 phút), mastery theo khái niệm.
- **Giữ chân:** W1/W4 retention (mục tiêu W4 > 30% tự do, > 65% có lớp/giải), số phiên/tuần.
- **AI:** % lượt hỏi giúp học sinh qua màn trong 3 lần chạy tiếp, % câu trả lời lộ đáp án (mục tiêu ≈ 0).
- **Thương mại:** Free → Paid (3,5% năm 1), CAC kết hợp < 280k, tỷ lệ mở ZNS.
- **Kỹ thuật:** FPS p75 theo hạng máy, thời gian tải p95, độ trễ chấm bài, 0 lần sai lệch replay.

---

## 13. Rủi ro lớn và cách giảm
| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Dữ liệu trẻ em (luật bảo vệ dữ liệu cá nhân mới, đồng ý của phụ huynh) | Cao | Tư vấn luật sớm, thu thập tối thiểu, phụ huynh đồng ý, dữ liệu lưu ở VN/khu vực phù hợp |
| Bị coi là game cần giấy phép | Trung bình | Không bán vật phẩm ảo tăng sức mạnh, không giao dịch, định vị là nền tảng giáo dục |
| Gian lận giải đấu | Cao | Server chấm replay (G0), phòng thi có giám sát, phát hiện code trùng |
| Máy trường quá yếu | Cao | Đo thật từ G0, chế độ "siêu nhẹ" (gần 2D) làm phương án dự phòng |
| AI nói sai / không phù hợp | Trung bình | Guardrails, bộ đánh giá, log để giáo viên xem, không sinh lời giải |
| Đối thủ (VioEdu, MindX…) làm theo | Trung bình | Tốc độ, cộng đồng giải đấu, thương hiệu Mầm, quan hệ với giáo viên |
| Đội quá mỏng, phụ thuộc 1 người | Cao | Tài liệu hoá (đã có CLAUDE.md), tuyển 2 vị trí con người đầu tiên ngay |
| Số liệu nghiên cứu chưa kiểm chứng | Trung bình | Kiểm chứng nguồn trước khi gọi vốn; số thật đến từ pilot |

---

## 14. Việc cần bạn quyết định ngay
1. **Duyệt hướng "giữ lõi, đập vỏ"** thay vì viết lại 100%. Viết lại hết sẽ mất thêm ~3–4 tháng để có lại đúng những gì đang chạy.
2. **Tên / thương hiệu:** giữ "OneRoboLab" hay đặt tên mới thân thiện tiếng Việt? Cần kiểm tra trùng nhãn hiệu.
3. **Đối tác pilot:** bạn có sẵn quan hệ với trường hay trung tâm nào không?
4. **Ngân sách / gọi vốn:** tự chi hay cần hồ sơ gọi vốn (pitch deck từ bản kế hoạch này)?
5. **Cho phép bắt đầu G0** (4 tuần nền móng kỹ thuật).

Khi bạn duyệt, bước tiếp theo: Claude chia G0 thành các gói việc, giao cho agent, review chéo và báo lại cuối giai đoạn.
