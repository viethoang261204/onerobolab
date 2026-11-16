# World 1: Starter Island — Bản thiết kế chi tiết 12 Levels + Boss (Chuẩn CSTA 1B)

**Đối tượng:** Học sinh làm quen lập trình & Robotics (CSTA Level 1B).  
**Ngôn ngữ:** Blocks (Level 1–8) → Blocks + Python highlight (Level 9–10) → Python Split (Level 11–12 & Boss).  
**Hệ quy chuẩn không gian:** Lưới chuẩn **`CELL = 0.6 m`**. Mặt sân hiển thị vạch ô lưới rõ ràng; `robot.step(n)` đi đúng `n` ô (`n × 0.6 m`), `robot.turn_left()` / `robot.turn_right()` xoay đúng `90°`.

---

## Tổng quan 12 Levels + 1 Boss

| Level | Tên màn | Chuẩn CSTA | API mới mở khóa | Variants (Chống hardcode) | Par Blocks |
|---|---|---|---|---|---|
| **1-01** | First Dispatch | `1B-AP-10` (Sequence) | `robot.step(n)`, `turn_left()`, `turn_right()` | Tĩnh (làm quen) | 5 |
| **1-02** | The Detour | `1B-AP-08` (Refine algorithm) | *(Reused)* | Tĩnh (chọn đường ngắn nhất) | 7 |
| **1-03** | Staircase Loop | `1B-AP-10` (Loops) | `for i in range(n):` | Tĩnh (ép dùng loop qua `parBlocks`) | 5 |
| **1-04** | Supply Chain | `1B-AP-10` (Loops + Actions) | `robot.pick()`, `robot.drop()` | Tĩnh (3 trạm lặp đều nhau) | 6 |
| **1-05** | Smart Crossing | `1B-AP-10` (Events & Wait) | `sensor.traffic_light()`, `robot.wait()` | **3 pha đèn ngẫu nhiên** | 6 |
| **1-06** | Broken Bridge | `1B-AP-10` (Conditionals) | `sensor.is_blocked()`, `if / else` | **2 variants: cầu trên hoặc cầu dưới sập** | 8 |
| **1-07** | Patrol Corridor | `1B-AP-10` (Loops + Conditionals) | `while not at_goal:` (hoặc `repeat` + `if`) | **3 variants: vị trí đá chắn khác nhau** | 7 |
| **1-08** | Color Sorter | `1B-AP-09`, `1B-AP-10` | `sensor.color()`, biến `delivered` | **3 variants: màu kiện hàng Đỏ/Xanh đổi chỗ** | 10 |
| **1-09** | Precision Gate | `1B-AP-09` (Variables & Threshold) | `sensor.distance()` | **2 variants: khoảng cách cổng thay đổi** | 8 |
| **1-10** | Storm Line | `1B-AP-10` (Feedback loop) | `sensor.on_line()`, `if/else` | **2 variants: khúc cua đổi hướng** | 9 |
| **1-11** | Rescue Squad | `1B-AP-11` (Decomposition) | `def handle_station():` (hàm không tham số) | **2 variants: thứ tự trạm** | 10 |
| **1-12** | **Boss: Island Recovery** | Tổng hợp `1B-AP-08..14` | Toàn bộ API World 1 | **3 variants ngẫu nhiên liên tiếp** | 14 |

---

## Chi tiết thiết kế từng Level

### Level 1-01 · First Dispatch (Khởi động trạm giao hàng)
- **Chuẩn CSTA:** `1B-AP-10` (Tạo chương trình có cấu trúc tuần tự).
- **Environment:** `starter-courtyard` (lưới `7 × 5` ô, `CELL = 0.6 m`).
- **Bài toán:** Robot xuất phát tại `(1, 2)` hướng Đông (`+X`), đi thẳng `3` ô, rẽ trái, đi `2` ô tới vùng giao hàng `(4, 4)`.
- **API mở khóa:** `robot.step(n)`, `robot.turn_left()`, `robot.turn_right()`.
- **Tại sao không vô nghĩa:** Không phải đoán `180 cm` hay `120 cm` — học sinh đếm trực tiếp số ô trên lưới và hiểu khái niệm *hướng tương đối của robot* (rẽ trái từ hướng Đông thành hướng Bắc).
- **Reference Python:**
```python
robot.step(3)
robot.turn_left()
robot.step(2)
```

---

### Level 1-02 · The Detour (Đường ngắn nhất)
- **Chuẩn CSTA:** `1B-AP-08` (So sánh và chọn thuật toán hiệu quả hơn cho cùng một nhiệm vụ).
- **Environment:** `starter-creek-bridge` (lưới `8 × 6` ô).
- **Bài toán:** Có 2 lối qua suối: lối vòng phía Bắc mất 11 ô, lối hẹp phía Nam qua cầu gỗ chỉ mất 7 ô. Cả 2 đều qua được, nhưng **3★ (`parBlocks = 7`, `parSeconds = 15`)** chỉ đạt được khi chọn đường tối ưu.
- **Mục tiêu sư phạm:** Học sinh tự so sánh 2 phương án trước khi code (*PREDICT step*).

---

### Level 1-03 · Staircase Loop (Cầu thang lặp)
- **Chuẩn CSTA:** `1B-AP-10` (Sử dụng vòng lặp để loại bỏ code trùng lặp).
- **Environment:** `starter-meadow-zig` (lưới `8 × 8` ô).
- **Bài toán:** Con đường hình bậc thang gồm **5 nhịp giống hệt nhau**: mỗi nhịp đi thẳng 1 ô, rẽ trái, đi 1 ô, rẽ phải.
- **Cơ chế ép học:** Giới hạn tối đa **6 blocks** trong toolbox/par. Nếu viết tuần tự sẽ cần `5 × 4 = 20` blocks → bắt buộc dùng `for i in range(5):`.
- **API mới:** `for i in range(n):` (`control.repeat`).
- **Reference Python:**
```python
for i in range(5):
    robot.step(1)
    robot.turn_left()
    robot.step(1)
    robot.turn_right()
```

---

### Level 1-04 · Supply Chain (Chuỗi cung ứng lặp)
- **Chuẩn CSTA:** `1B-AP-10` (Kết hợp vòng lặp và hành động tương tác).
- **Environment:** `starter-campus-crossing`.
- **Bài toán:** Có 3 kiện hàng đặt cách đều nhau mỗi 2 ô dọc theo hành lang, bên cạnh mỗi kiện là 1 ô nhận hàng (`delivery zone`) cách 1 ô bên phải.
- **API mới:** `robot.pick()`, `robot.drop()`.
- **Reference Python:**
```python
for i in range(3):
    robot.step(2)
    robot.pick()
    robot.turn_right()
    robot.step(1)
    robot.drop()
    robot.turn_left()
```

---

### Level 1-05 · Smart Crossing (Ngã tư đèn thông minh)
- **Chuẩn CSTA:** `1B-AP-10` (Điều khiển luồng dựa trên sự kiện/trạng thái).
- **Environment:** `starter-traffic-crossing`.
- **Bài toán:** Giữa đường có 1 ngã tư đèn giao thông. Vượt đèn đỏ sẽ bị fail ngay lập tức.
- **Variants (Chống hardcode):**
  - Variant A: Đèn bắt đầu Đỏ trong 3 giây.
  - Variant B: Đèn bắt đầu Xanh ngay.
  - Variant C: Đèn bắt đầu Đỏ trong 5 giây.
  *(Nếu học sinh viết `robot.wait(3)` cố định sẽ fail ở Variant C hoặc mất điểm thời gian ở Variant B).*
- **API mới:** `sensor.traffic_light()`, `robot.wait(sec)`.
- **Reference Python:**
```python
robot.step(2)
while sensor.traffic_light() != "green":
    robot.wait(0.5)
robot.step(3)
```

---

### Level 1-06 · Broken Bridge (Cây cầu gãy)
- **Chuẩn CSTA:** `1B-AP-10` (Cấu trúc rẽ nhánh `if / else`).
- **Environment:** `starter-creek-bridge`.
- **Bài toán:** Có 2 cây cầu song song bắc qua sông: cầu thẳng (cầu 1) và cầu bên phải (cầu 2).
- **Variants (Chống hardcode):**
  - Variant A: Cầu 1 bị tảng đá chặn ở lối vào.
  - Variant B: Cầu 1 thông thoáng, cầu 2 bị chặn.
- **API mới:** `sensor.is_blocked()`, `if / else`.
- **Reference Python:**
```python
robot.step(2)
if sensor.is_blocked():
    robot.turn_right()
    robot.step(2)
    robot.turn_left()
robot.step(3)
```

---

### Level 1-07 · Patrol Corridor (Hành lang đá lở)
- **Chuẩn CSTA:** `1B-AP-10` (Kết hợp vòng lặp + điều kiện rẽ nhánh).
- **Environment:** `starter-canyon-pass`.
- **Bài toán:** Hành lang dài 6 ô, có 1–2 ô bị đá lở chặn (phải rẽ sang làn phụ bên trái để né rồi quay lại làn chính).
- **Variants (Chống hardcode):** Đá lở xuất hiện ở ô thứ 2, ô thứ 4, hoặc cả 2 ô.
- **Reference Python:**
```python
for i in range(6):
    if sensor.is_blocked():
        robot.turn_left()
        robot.step(1)
        robot.turn_right()
        robot.step(1)
        robot.turn_right()
        robot.step(1)
        robot.turn_left()
    else:
        robot.step(1)
```

---

### Level 1-08 · Color Sorter (Kho phân loại sắc màu)
- **Chuẩn CSTA:** `1B-AP-09` (Tạo và cập nhật biến), `1B-AP-10`.
- **Environment:** `starter-warehouse`.
- **Bài toán:** Robot lấy hàng tại bến bãi, đọc màu trên sàn dưới kiện hàng: màu `"red"` giao vào kho bên Trái, màu `"blue"` giao vào kho bên Phải. Cập nhật biến đếm `delivered = delivered + 1` sau mỗi lần giao.
- **Variants:** Thứ tự 4 kiện hàng đổi ngẫu nhiên (`R-B-R-B`, `B-R-B-R`, `R-R-B-B`).
- **API mới:** `sensor.color()`, biến `count`.

---

### Level 1-09 · Precision Gate (Cổng quét khoảng cách)
- **Chuẩn CSTA:** `1B-AP-09` (Biến & Phép so sánh số thực).
- **Environment:** `starter-facility-yard`.
- **Bài toán:** Cổng an ninh chỉ mở khi robot tiến lại gần và dừng lại ở khoảng cách **0.4 m – 0.8 m** trước cảm biến cổng (đâm vào cổng hoặc đứng quá xa đều không mở).
- **Variants:** Vị trí cổng đặt ở `3.0 m` hoặc `4.2 m` từ điểm xuất phát.
- **API mới:** `sensor.distance()`.
- **Reference Python:**
```python
while sensor.distance() > 0.6:
    robot.step(0.5)
robot.wait(1.5)  # chờ cổng mở
robot.step(2)
```

---

### Level 1-10 · Storm Line (Dò vạch dẫn đường)
- **Chuẩn CSTA:** `1B-AP-10` (Vòng lặp phản hồi — Feedback Control).
- **Environment:** `starter-forest-trail`.
- **Bài toán:** Trời sương mù, chỉ có vạch sơn trắng dẫn về trạm. Robot tiến từng bước nhỏ; nếu lệch vạch (`not sensor.on_line()`), xoay nhẹ kiểm tra trái/phải để bám lại vạch.
- **Variants:** Khúc cua đổi hướng Trái → Phải hoặc Phải → Trái.
- **Chuyển tiếp:** Mở chế độ **Python highlight** song song với Blocks.

---

### Level 1-11 · Rescue Squad (Phân rã bài toán bằng Hàm)
- **Chuẩn CSTA:** `1B-AP-11` (Phân rã bài toán lớn thành các bài toán con).
- **Environment:** `starter-rescue-outpost`.
- **Bài toán:** Có 3 trạm cứu hộ giống nhau về cấu trúc (kiểm tra đèn → nhặt hàng → giao hàng), nằm nối tiếp nhau. Học sinh tách quy trình xử lý 1 trạm thành hàm `def rescue_station():` và gọi lại 3 lần.
- **API mới:** `def rescue_station():` (`function.define` / `function.call`).
- **Chuyển tiếp:** Mở chế độ **Blocks ⇄ Python Split** (học sinh có thể gõ trực tiếp Python).

---

### Level 1-12 · Boss: Island Recovery (Khôi phục Đảo Khởi Đầu)
- **Chuẩn CSTA:** Tổng hợp `1B-AP-08`, `1B-AP-09`, `1B-AP-10`, `1B-AP-11`.
- **Environment:** `starter-rescue-city`.
- **Bài toán tổng hợp:**
  1. Vượt ngã tư đèn giao thông (`sensor.traffic_light()`).
  2. Tránh đoạn đường bị đá sạt lở ngẫu nhiên (`sensor.is_blocked()`).
  3. Nhặt kiện hàng, kiểm tra màu để rẽ vào đúng trạm Y tế (Đỏ) hoặc Trạm Năng lượng (Xanh) (`sensor.color()`).
  4. Dừng trước cổng trạm cứu hộ cuối cùng (`sensor.distance()`).
- **Điều kiện qua màn:** Hệ thống chạy thử nghiệm code trên **3 variants liên tiếp**; qua cả 3 mới mở khóa **World 2: Canyon Circuit**.
