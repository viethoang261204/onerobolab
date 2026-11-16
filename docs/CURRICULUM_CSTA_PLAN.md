# OneRoboLab — Tài liệu Chuẩn Thiết kế Chương trình Robotics Online (CSTA K–12 × CodeCombat Model)

**Phiên bản:** 1.0  
**Phạm vi:** Định hướng sư phạm, hệ thống API Spellbook, ma trận chuẩn CSTA (Level 1B → 3A) và lộ trình nâng cấp kỹ thuật cho nền tảng **OneRoboLab (`robo3d`)**.

---

## 1. Vấn đề của mô hình hiện tại & Bài học từ CodeCombat

Khi triển khai chương trình học lập trình robot 3D trực tuyến, sai lầm phổ biến nhất là biến bài học thành **"đo thước bằng mắt"** (học sinh phải đoán xem vật cản cách 80 cm hay 90 cm để nhập số vào `move_forward(cm)`). Điều này gây 3 hệ quả:
1. **Không học được tư duy Khoa học Máy tính (CS):** Học sinh tốn 80% thời gian thử-sai khoảng cách thay vì học vòng lặp, điều kiện, biến, hàm hay thuật toán.
2. **Dễ học vẹt (Hardcoding):** Khi bản đồ tĩnh, học sinh chỉ cần viết một chuỗi lệnh cố định là qua màn mà không cần dùng cảm biến hay logic.
3. **Đứt mạch phản hồi:** Tách rời trình soạn thảo code và màn hình 3D khiến học sinh khó quan sát mối liên hệ giữa từng dòng code và hành vi robot.

### Giải pháp theo mô hình CodeCombat × CSTA
1. **Lưới chuẩn (Grid Step) cho cấp độ cơ bản:** Thay vì đoán cm ở các màn đầu, sân tập chia thành các ô lưới rõ ràng (`1 step = 0.6 m`). Học sinh dùng `robot.step(n)` và `robot.turn_left()` / `robot.turn_right()` (90°) để tập trung vào **logic**. (Các bài nâng cao về *Odometry / Precision* mới dùng cm/độ tự do).
2. **API Spellbook (Từ điển Phương thức mở khóa dần):** Giống trang bị của CodeCombat, mỗi chặng mở khóa thêm cảm biến và phương thức mới, có chữ ký hàm (`signature`), kiểu trả về và ví dụ 1 dòng ngay cạnh vùng viết code.
3. **Chống học vẹt bắt buộc (`variants`):** Tận dụng `LevelDefinition.variants` — từ Level 4 trở đi, vị trí vật cản, đèn giao thông, kiện hàng thay đổi qua nhiều test case. Code phải giải đúng **tất cả các biến thể** mới qua màn.
4. **Môi trường học tích hợp (Integrated IDE):** Viewport 3D + Code Editor (Blocks/Python) + API Spellbook + Console/Variables nằm trên **một màn hình duy nhất**, highlight dòng code đang chạy theo thời gian thực.

---

## 2. Hệ thống API Spellbook chuẩn (5 Tầng mở khóa)

Học sinh tương tác với thế giới 3D thông qua 3 đối tượng chính: `robot`, `sensor`, và `world`.

### Tầng 1 · Motion & Basic Actions (World 1: Level 1–4)
| API (Python) | Block tương ứng | Kiểu trả về | Mô tả |
|---|---|---|---|
| `robot.step(n=1)` | `step forward [n]` | `None` | Tiến `n` ô lưới chuẩn (`1 ô = 0.6 m`). |
| `robot.turn_left()` | `turn left 90°` | `None` | Xoay trái 90° tại chỗ. |
| `robot.turn_right()` | `turn right 90°` | `None` | Xoay phải 90° tại chỗ. |
| `robot.wait(sec)` | `wait [sec] s` | `None` | Đứng yên chờ `sec` giây. |

### Tầng 2 · Actuators & Reactive Sensors (World 1: Level 5–12)
| API (Python) | Block tương ứng | Kiểu trả về | Mô tả |
|---|---|---|---|
| `robot.pick()` | `pick crate` | `bool` | Nhặt kiện hàng ở ô trước mặt / hiện tại. |
| `robot.drop()` | `drop crate` | `bool` | Đặt kiện hàng xuống vùng đích. |
| `sensor.is_blocked()` | `obstacle ahead?` | `bool` | `True` nếu có tường/vật cản ngay ô phía trước. |
| `sensor.color()` | `floor color` | `str` | Trả về `"red" \| "green" \| "blue" \| "yellow" \| "none"`. |
| `sensor.traffic_light()` | `traffic signal` | `str` | Trả về `"red" \| "yellow" \| "green"` tại ngã tư phía trước. |
| `sensor.on_line()` | `on guide line?` | `bool` | `True` nếu cảm biến dò vạch đang nằm trên đường kẻ. |
| `sensor.distance()` | `distance (m)` | `float` | Khoảng cách tới vật cản phía trước (tối đa `2.0 m`). |

### Tầng 3 · Functions, Speed & Compound Logic (World 2: Level 13–22)
| API (Python) | Kiểu trả về | Mô tả |
|---|---|---|
| `def my_func(param1, ...):` | `Any` | Định nghĩa hàm có tham số và `return`. |
| `robot.set_speed(percent)` | `None` | Điều chỉnh tốc độ `20..100` (%). |
| `robot.move_cm(cm)` / `robot.turn_deg(deg)` | `None` | Điều khiển chính xác theo đơn vị đo (bài toán *Precision*). |

### Tầng 4 · World Data & Collections (World 3: Level 23–30)
| API (Python) | Kiểu trả về | Mô tả |
|---|---|---|
| `world.get_crates()` | `list[Crate]` | Danh sách kiện hàng (`.x`, `.y`, `.color`, `.urgent`). |
| `world.get_zones()` | `list[Zone]` | Danh sách vùng giao hàng (`.x`, `.y`, `.color`, `.kind`). |
| `robot.position()` | `tuple[int, int]` | Tọa độ ô `(col, row)` hiện tại của robot. |
| `robot.go_to(col, row)` | `None` | Di chuyển tới ô `(col, row)` theo trục. |
| `world.distance(a, b)` | `float` | Khoảng cách Manhattan / Euclid giữa 2 điểm. |

### Tầng 5 · Autonomy & Resource Management (World 4: Level 31–36)
| API (Python) | Kiểu trả về | Mô tả |
|---|---|---|
| `robot.battery()` | `float` | Phần trăm pin còn lại (`0..100`). |
| `world.get_chargers()` | `list[Charger]` | Danh sách trạm sạc trên bản đồ. |
| `world.scan_grid()` | `list[list[int]]` | Ma trận bản đồ (`0`: trống, `1`: tường, `2`: nguy hiểm). |
| `world.neighbors(col, row)` | `list[tuple[int, int]]` | Các ô lân cận hợp lệ (hỗ trợ cài đặt **BFS / A\***). |

---

## 3. Ma trận chuẩn CSTA K–12 qua 4 Worlds (36 Levels)

| World | Tên thế giới | Chuẩn CSTA | Ngôn ngữ | Trọng tâm kiến thức CS | Số Level |
|---|---|---|---|---|---|
| **World 1** | **Starter Island** | **CSTA Level 1B** (Grades 3–5) | Blocks → Python Preview | `1B-AP-10` (Sequence, Loop, Event, Conditional), `1B-AP-09` (Variables), `1B-AP-11` (Decomposition), `1B-AP-08` (Compare algorithms) | 12 core + 1 Boss |
| **World 2** | **Canyon Circuit** | **CSTA Level 2** (Grades 6–8) | Python chính thức | `2-AP-14` (Functions w/ params), `2-AP-12` (Nested loops, Boolean `and/or/not`), `2-AP-10` (Flowcharts/`while`/`break`), `2-AP-17` (Multi-variant testing) | 10 |
| **World 3** | **Frost Valley** | **CSTA Level 2 → 3A** | Python | `3A-AP-14` (Lists, Dictionaries), `2-AP-11` (Data types), `3A-AP-15` (Control tradeoffs), `3A-AP-17` (Sense-Plan-Act modularity) | 8 |
| **World 4** | **Sky Lab / Lava Core** | **CSTA Level 3A** (Grades 9–10) | Python | `3A-AP-13` (Graph/BFS algorithms, Resource management), `3A-AP-21` (Efficiency & Complexity evaluation) | 6 |

---

## 4. Cơ chế Đánh giá & Thưởng (Scoring & Anti-Hardcode)

Mỗi màn chơi được chấm điểm theo 3 tầng mục tiêu:
1. **Primary (1★ — Hoàn thành):** Giải đúng tất cả **Variants (Test Cases)** của màn mà không va chạm hay vào vùng nguy hiểm.
2. **Secondary (2★ — Hiệu quả thời gian):** Hoàn thành trong giới hạn `parSeconds`.
3. **Optional (3★ — Tối ưu thuật toán):** Tổng số block / dòng code `<= parBlocks` (đây là đòn bẩy ép học sinh dùng `for`, `def`, `dict` thay vì copy-paste).

---

## 5. Lộ trình nâng cấp kỹ thuật trên `robo3d`

Để triển khai đầy đủ 4 Worlds trên nền tảng `robo3d` hiện tại:

1. **Ngắn hạn (Triển khai World 1 ngay được):**
   - Thêm helper `gridStep(steps)` vào `kit.ts` / `compiler` (biên dịch `robot.step(n)` → `move_forward(n * 0.6)`).
   - Hiển thị **vạch lưới 0.6 m** trên mặt sân trong `GameplayLayer` để học sinh nhìn rõ từng ô.
   - Bật **API Spellbook panel** và **Split-screen Code + 3D** cho chế độ học nhanh.
2. **Trung hạn (Phục vụ World 2 & 3):**
   - Mở rộng `Program` IR (`packages/shared/src/types/program.ts`) và `CommandQueue` (`packages/robot-engine`) để hỗ trợ: hàm có tham số + `return`, kiểu `List`, `Dict`, và truy cập thuộc tính (`crate.color`).
   - Cập nhật `pythonToBlocks` & `apps/api/src/domain/program.ts` để validate các node mới.
3. **Dài hạn (Phục vụ World 4):**
   - Bổ sung `battery` vào `RobotState` (`packages/robot-engine`) và `world.scan_grid()` vào `MapQuery` (`packages/map-engine`).
   - Triển khai **Server-side Headless Replay** bằng `@robolab/simulation` trong `apps/api` để xác thực kết quả tuyệt đối.
