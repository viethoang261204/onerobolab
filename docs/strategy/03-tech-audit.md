# 03 — Đánh giá kỹ thuật (CTO audit)

> Nguồn: agent CTO (Claude) đọc repo, 2026-11-26. Chưa chạy app/test.

## Kết luận: TIẾN HOÁ, không đập bỏ lõi
Lõi giá trị (~10–12k LOC) là thứ khó làm lại: engine tất định, IR, editor khối, pipeline nội dung. Cái thiếu (multiplayer, lớp học, thanh toán, AI) đằng nào cũng là code mới. Chỉ viết lại "vỏ" frontend nếu không thể làm mobile/responsive.

## Hiện trạng
- `apps/web` ~42.9k LOC (simulator 8.7k, admin 8.4k, programming 5.9k, adventure-map 3.0k, world-map 2.8k, garage 2.6k), `apps/api` 5.4k, `database` 4.3k (29 bảng, 8 migration), `packages` ~4.1k.
- `packages/simulation`, `packages/blockly-engine` là stub rỗng.
- 31 file test / ~334 test case; mỗi level có lời giải mẫu được test đạt 3 sao.
- Xong: UI 1–8, backend phase 1–4, admin, adventure map, garage, 24 nhiệm vụ Starter Island. Các world khác gần như trống.

## Giữ / sửa / viết lại
| Hệ thống | Quyết định | Lý do |
|---|---|---|
| Engine `packages/*-engine` | Giữ | Thuần TS, tất định, có contract + test. Vật lý chỉ 2D. |
| SimulationRuntime (đang nằm trong web) | **Refactor ưu tiên #1** | Chuyển vào `packages/simulation` để chạy headless trên server. |
| Level (đang là code TS) | Refactor | Phải thành JSON thuần để replay trên server + editor không cần code. |
| Compiler + IR | Giữ, chuyển sang package | Không eval, có blockId trên mọi lệnh. |
| Block editor (tự viết, không phải Blockly) | Giữ | 43 khối, undo/redo; cần kiểm tra touch/a11y. |
| Python subset → blocks | Giữ + mở rộng | Có trần; học sinh lớn cần Python thật (Pyodide/VM sandbox). |
| API + DB | Giữ | Bảo mật tốt, ledger. Thiếu bảng trường/lớp; server tin `objectivesCompleted` từ client. |
| Admin | Giữ làm công cụ nội bộ | Map editor đang là JSON thô. |
| World/Adventure map, Garage | Giữ | Hình ảnh tốt; garage chỉ lưu localStorage, 3 model placeholder. |

## Nợ kỹ thuật & rủi ro
- **Gian lận (nghiêm trọng cho thi đấu):** client có thể gửi kết quả giả → cần chấm bằng replay headless trên server.
- Thêm 1 khối phải sửa 5 chỗ; công thức điểm bị nhân đôi web/api.
- Chưa đo FPS trên máy yếu thật (Chromebook, Android VN).
- `App.tsx` `min-w-[1024px]` → không có mobile.
- Không có i18n; toàn bộ chuỗi tiếng Anh cứng.
- 1 instance Fastify, `GET /api/catalog` nguyên khối — chưa sẵn sàng cho đỉnh tải thi đấu toàn quốc.
- Không có WebSocket/realtime.

## Còn thiếu cho sản phẩm mục tiêu
Thi đấu realtime (phòng, lịch thi, bảng xếp hạng, chấm replay, đấu 2 chương trình cùng sân, khán giả), giáo viên/lớp (trường, lớp, mã tham gia, bài tập, sổ điểm, import CSV, phụ huynh), AI tutor (chưa có gì, nhưng hint tier + blockId + runtime events là móc tốt), thanh toán (VNPay/MoMo/ZaloPay, gói, license trường), công cụ tạo level trực quan, pipeline analytics.

## 90 ngày đầu (kỹ thuật)
1. Runtime + compiler + level map → packages, chạy headless.
2. Server chấm run bằng replay.
3. i18n, tiếng Việt trước.
4. Responsive/touch + tối ưu máy yếu.
5. Trường / lớp / vai trò giáo viên.
6. Dịch vụ realtime cho thi đấu.
