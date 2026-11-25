# OneRoboLab — 3D Design Direction

## Tóm tắt 10 ý

1. Chọn **Bright Workshop Diorama**: stylized low-poly với bề mặt mềm, silhouette rõ, màu ấm và điểm nhấn kỹ thuật phát sáng; tránh hiện thực nặng và neon phủ toàn màn.
2. Giữ robot procedural, rig/animation, paint/accessory system, world diorama, prop batching và quality presets hiện có; thống nhất chúng qua một style guide và asset pipeline.
3. Làm mới hero robot thành bạn đồng hành có biểu cảm bằng mắt/đèn, thân modular và hình khối dễ nhận ra ở kích thước nhỏ; hình ảnh hoàn toàn nguyên bản.
4. Dùng hành trình 8 thế giới lấy cảm hứng địa lý Việt Nam theo hướng hư cấu, không tái dựng địa danh như bản sao: vịnh đảo, phố đèn, ruộng bậc thang, đô thị sông, rừng mưa, cao nguyên gió, cảng lạnh và quỹ đạo.
5. Mỗi thế giới dùng cùng một mission-object kit có biến thể giao diện: sensor, gate, conveyor, cargo, drone, arm, signal và hazard; giữ affordance nhất quán cho việc học.
6. Tạo Arena riêng cho cuộc thi với camera spectator, replay, telemetry và overlay có thể đọc được ở livestream; thi đấu dựa trên command log xác minh được.
7. Ưu tiên baked lighting, instancing, LOD, texture atlas/KTX2 và giới hạn DPR; WebGL2 là baseline, WebGPU chỉ là progressive enhancement có fallback.
8. Đặt ngân sách riêng cho máy yếu: mục tiêu 60 FPS ở scene gọn, low preset giảm draw calls/triangles/textures đáng kể so với mức medium hiện tại.
9. Xây production team nhỏ gồm art director/3D generalist, environment artist và technical artist; ưu tiên reusable kit thay vì làm mọi prop độc lập.
10. Roadmap: MVP khóa style và một vertical slice; v1 hoàn thiện 4–6 world cùng Arena; v2 mở rộng 8 world, replay/multiplayer và AR thử nghiệm.

## 1. Audit trung thực về 3D hiện tại

Audit dựa trên đọc source; chưa có lượt đánh giá hình ảnh trực tiếp trên toàn bộ màn hình. Do đó các nhận xét “amateur” dưới đây nói về rủi ro trong cách hệ thống thể hiện, không khẳng định mọi asset đều có chất lượng thấp.

### Điểm đang làm tốt

- **Hero robot có chủ đích nhân vật**: `Robot.tsx` cập nhật pose, bánh, đầu, mắt và LED qua refs trong `useFrame`, tránh React render mỗi frame. `RobotAnimation.ts`, `RobotDisplay.tsx`, `RobotHead.tsx` là cơ sở tốt cho companion có cảm xúc.
- **Digital twin đã có nền tảng**: tỷ lệ bánh lấy từ `RobotDefinition`, robot được điều khiển từ runtime, cảm biến có thể hiển thị (`Robot.tsx`, `RobotSensors.tsx`, `RobotMovement.ts`). Đây là lợi thế học tập quan trọng.
- **Customization là một hệ thống thật**: garage đã có paint, decal, accessory, mount và unlock (`garage/model/catalog.ts`, `garage/render/part-materials.ts`, `attachments.tsx`, `PersonalRover.tsx`). Không cần xây lại từ đầu.
- **World map tiết kiệm draw calls**: `world-map/scene/BakedDiorama.tsx` gộp phần tĩnh thành vertex-coloured mesh và dùng instancing cho phần còn lại. `adventure-map/scene3d/AdventureCanvas.tsx` chia batch cho scenery/state/live props.
- **Môi trường có mood riêng**: `simulator/environments/lighting.ts` khai báo profile, `EnvironmentRegistry.ts` và `scenes/` tổ chức scene theo level. `world-map/scene/theme-palettes.ts` và `theme-materials.ts` đã tách theme ra khỏi logic.
- **Đã có tư duy máy yếu**: `CLAUDE.md` mục Performance yêu cầu GLB, instancing, shared materials, DPR caps, lazy chunks, pause off-screen canvas và một shadow-casting light.

### Rủi ro làm hình ảnh trông amateur hoặc thiếu nhất quán

- Nhiều profile màu/ánh sáng tốt riêng lẻ nhưng thiếu một art bible buộc hue, saturation, roughness, bevel, tỷ lệ chi tiết và tương phản UI phải đồng bộ giữa simulator, world map, adventure map và garage.
- Hero robot hiện procedural bằng các khối (`RobotBody.tsx`, `RobotHead.tsx`, `RobotWheels.tsx`). Ưu điểm là rẻ và modular; nếu thiếu silhouette độc quyền, face language và chi tiết nhận diện, dễ giống prototype kỹ thuật hơn nhân vật có thể thương mại hóa.
- Asset procedural/primitive phù hợp MVP, nhưng dùng chung primitive language quá lâu khiến props, buildings và mission objectives có cảm giác kitbash hoặc “dev art”. Cần một lượt model/lighting polish có chọn lọc.
- Map diorama và gameplay simulator có hai framing/visual grammar khác nhau. Cần dùng chung shape language, palette tokens, iconography và material rules để chuyển màn liền mạch.
- Current performance budget ở `CLAUDE.md` medium cho simulator khoảng 200–240 draw calls và 150k triangles, mặc shadows. Đây là trần hiện trạng chứ chưa phải cam kết 60 FPS cho Chromebook/Android yếu; cần đo trên thiết bị đại diện và bổ sung low-specific budget.
- Phần runtime hiện mô tả source “demo autopilot now, engine/physics later” trong `Robot.tsx`; physics/determinism cho thi đấu chưa phải năng lực đã chứng minh. Không nên quảng bá fair competition trước khi xác minh được lệnh và replay.

### Quyết định keep / rework / drop

| Quyết định | Thành phần | Hành động |
|---|---|---|
| **Keep** | `simulator/robot/Robot.tsx`, rig, eye/LED states, sensor visuals | Giữ procedural core, sửa silhouette và biểu cảm; giữ mỗi trạng thái gameplay có tín hiệu dễ hiểu. |
| **Keep** | `garage/render/part-materials.ts`, `attachments.tsx`, `PersonalRover.tsx` | Giữ customization; chuyển catalog sang modular attachment có bounds, LOD và validation. |
| **Keep** | `world-map/scene/BakedDiorama.tsx`, `environment/Instanced.tsx`, `environments/props/BatchMesh.tsx` | Giữ batching/instancing và cơ chế bake; đưa artist asset qua pipeline tương thích. |
| **Keep** | `environments/lighting.ts`, theme palettes/materials, `QUALITY_DPR` | Giữ data-driven mood và preset; định nghĩa tokens chung, không cho mỗi world tự phát triển shader/material. |
| **Rework** | `environments/scenes/*`, `adventure-map/scene3d/*` | Làm lại landmark hero, silhouette và bố cục theo visual target; tái dùng đường, terrain, kit props và logic layout phù hợp. |
| **Rework** | `garage/scene/GarageCanvas.tsx`, `garage/render/models.tsx` | Biến garage thành product showroom có pedestal, key/fill light và preview part rõ; vẫn tôn trọng cấu trúc module rẻ. |
| **Rework** | `simulator/environment/*`, `environments/gameplay/*` | Tách “readable gameplay geometry” khỏi set dressing; mission object có màu/trạng thái consistent, set dressing không cạnh tranh tương phản. |
| **Drop dần** | Scene chỉ gồm primitive placeholder khi có asset production-ready | Không xóa hàng loạt; thay theo từng world/mission để không làm gãy content. Giữ primitive làm debug/prototyping. |
| **Drop** | Particle/transparent effect không truyền đạt gameplay hoặc vượt ngân sách | Giới hạn số lượng, screen-space footprint; low tier tắt hoàn toàn. |

## 2. Visual identity

### So sánh phong cách

| Hướng | Ưu điểm | Rủi ro | Kết luận |
|---|---|---|---|
| Stylized low-poly toon | Dễ đọc, rẻ polygon, hợp diorama và tuổi 8–16, hình khối chạy tốt trên GPU yếu | Có thể chung chung, “game jam” nếu thiếu shape language/lighting tốt | Dùng làm nền, nhưng tăng bevel mềm và chi tiết thiết kế chọn lọc. |
| Soft-clay diorama | Ấm áp, tactile, thân thiện; vật thể lớn dễ nhận ra | Dễ thành đồ chơi mờ nhòe, roughness cao và shadow/contact quá nặng | Mượn chất liệu/mood, không làm mọi thứ giống đất sét. |
| Tech-noir neon | Tạo cảm giác công nghệ và arena hấp dẫn | Tương phản gắt, dễ mỏi mắt, tốn bloom/transparency, không hợp học sinh nhỏ | Chỉ dùng làm accent trong Arena/ban đêm, không làm nền thương hiệu. |

**Đề xuất:** “Bright Workshop Diorama” — một thế giới chế tạo robot sáng rõ, có bề mặt matte-satin, bevel mềm, màu có chủ đích và vài chi tiết emissive. Art độc quyền; không dùng nhân vật, thế giới, logo hay silhouette nhận diện của game khác.

### Palette và mood

| Token | Hex | Vai trò |
|---|---|---|
| Ink Navy | `#17324D` | Chữ đậm, outline/UI contrast, mặt dưới robot |
| Workshop Teal | `#12A6A1` | Màu nhận diện/chức năng sensor |
| Signal Coral | `#F26B5B` | Cảnh báo, thử thách, điểm nhấn ấm |
| Sun Mango | `#FFC857` | Thành công, vật phẩm tương tác, đèn ấm |
| Leaf Green | `#68B86B` | Vùng an toàn, thiên nhiên, tiến độ |
| Sky Mist | `#DCEFF2` | Nền sáng, fill light, panel/map distance |
| Paper Sand | `#F2E7D2` | Gạch, gỗ sáng, backdrop ấm |
| Plum Shade | `#665080` | World twilight/rare cosmetics, dùng tiết chế |

Tỷ lệ khởi điểm: 60% nền trung tính sáng, 30% màu world, 10% accent tương tác. Trong gameplay, sensor/gate/cargo có color coding ổn định; trạng thái cũng cần icon/shape để không phụ thuộc màu. Lighting chủ yếu golden morning hoặc overcast sáng mềm, shadow cạnh đủ để grounding; môi trường tối chỉ dùng làm set piece cục bộ. Không bật real-time shadow cho mọi vật.

### Vật liệu và hòa hợp UI–3D

- Dùng PBR tối giản: roughness chính 0.55–0.85; kim loại chỉ trên chi tiết nhỏ; tránh chrome phản chiếu môi trường tốn kém. Tối đa vài material family/world.
- Bevel ở cạnh lớn tạo highlight; chi tiết nhỏ truyền bằng albedo/normal atlas thay vì tăng polygon.
- HTML UI dùng cùng color tokens, bo góc, pictogram và trạng thái xanh/amber/coral. Overlay 3D chỉ dành cho sensor cone, waypoint, trajectory và selection; nội dung giải thích/chữ dài ở UI 2D.
- Nhiệm vụ có hierarchy: robot và objective luôn tương phản mạnh hơn scenery. Marker không che robot/collision area; chữ có outline/panel thay vì nằm trên texture cảnh.

### Vietnamese flavor, tinh tế và tôn trọng

Tạo địa danh hư cấu bằng hình khối và palette gợi liên tưởng, không bê nguyên danh thắng hay biểu tượng văn hóa. “Vịnh Mây Cong” dùng các đảo đá vôi bo tròn và tuyến phao robot; “Phố Đèn Gió” dùng đèn lồng hình học do xưởng chế tạo thiết kế, treo cao và làm đèn tín hiệu; “Ruộng Bậc Thang Mạch Nước” dùng tầng canh tác làm đường logic và cống sensor; “Sài Gòn Kênh Tương Lai” gợi nhịp đô thị ven kênh bằng cầu, bến và skyline hư cấu. Có thể dùng hoa văn sóng/nan đan như pattern trừu tượng trên decal, tránh coi trang phục/tín ngưỡng là vật phẩm hài hước hoặc skin exotic.

## 3. Hero robot và character system

### Companion: “Mầm” (working name)

Robot đồng hành nhỏ, tò mò, kiên nhẫn và hơi vụng dễ thương; không nói thay học sinh, mà phản hồi tiến trình: nhìn theo waypoint, chớp mắt khi sensor đọc, nghiêng đầu khi code sai và ăn mừng bằng đèn/pose khi hoàn thành. Tên có thể đổi sau user research/brand check.

- **Silhouette:** thân trung tâm như capsule bo vuông, đầu cảm biến gimbal lớn hơn thân một chút, hai bánh lớn nhìn rõ, một caster phía sau; một “fin”/anten lệch trục làm dấu nhận diện. Nhìn từ top-down vẫn nhận ra hướng robot.
- **Rig:** root → chassis → head yaw/pitch → eye panels; bánh trái/phải quay độc lập; gripper mount và sensor mounts theo sockets. Giữ rig low-bone, không cần facial rig phức tạp. Idle, detect, confused, success, blocked là pose states.
- **Biểu cảm:** mắt LED dạng glyph có vài shape (dot, arc, blink), tránh miệng/lông mày realistic. Color không là kênh duy nhất; pose và biểu tượng bổ sung accessibility.
- **Gameplay feedback:** sensor đọc có pulse ngắn; motor quay đúng hướng; va chạm có squash/tilt nhỏ và âm cue; lỗi logic có “think” pose chứ không thể hiện cảm xúc tiêu cực với học sinh.

### Garage progression

1. **Starter chassis:** bánh, bumper, front distance sensor; silhouette mặc định.
2. **Builder kits:** gripper, cargo tray, line sensor, camera mast; mở bằng nhiệm vụ và học khái niệm.
3. **Specialist kits:** mecanum/track visual variant, arm module, drone scout cosmetic/mission companion; chỉ mở khi phần physics/curriculum hỗ trợ tương ứng.
4. **Identity cosmetics:** paint palettes, decals do học sinh tạo, antenna/topper và animation emote; không pay-to-win và không thay collision/hardware semantics.

### Rival/NPC

NPC gồm robot chuyển phát, robot nông trại, robot sửa chữa và đối thủ học sinh trong giải. Mỗi nhóm chia chung skeleton/chassis family để tiết kiệm animation; khác biệt bằng silhouette module, tỷ lệ và palette. Rival vui vẻ, không phản diện/đe dọa. Tên/face/shape đều thiết kế riêng.

### Digital twin cho kit vật lý giá rẻ

`RobotDefinition` là nguồn chuẩn cho wheel radius, wheel spacing, tốc độ, sensor range, actuator limits và attachment sockets. Mỗi kit thật có calibration profile được version hóa; simulator render cùng sensor FOV, khoảng cách đo, độ trễ/quantization và giới hạn motor của kit. Garage chỉ cho gắn phần mà kit có hoặc có thể mô phỏng trong curriculum. Cần quy trình đối chiếu telemetry simulator với robot thật trước khi gọi là digital twin chính xác.

## 4. World journey: 8 thế giới

Hành trình tăng dần từ sequence/điều khiển đến sensor, loop, điều kiện, function và phối hợp nhiều robot.

| World | Kỹ năng chính | Set piece | Mission-object kit |
|---|---|---|---|
| 1. Xưởng Sân Nắng | Sequence, drive, turn | Sân lắp ráp, cầu dốc, cổng xuất phát | Button, gate, cargo, waypoint |
| 2. Vịnh Mây Cong | Sensor, obstacle avoidance | Cầu phao, đảo đá, phao định vị | Distance sensor, moving gate, buoy, ferry conveyor |
| 3. Phố Đèn Gió | Events, timing | Ngõ hư cấu, đèn lồng tín hiệu, cầu nâng | Traffic light, timed gate, delivery parcel, crossing sensor |
| 4. Ruộng Bậc Thang Mạch Nước | Loops, pattern, coordinates | Bậc ruộng, kênh nước, guồng năng lượng | Line sensor, pump arm, water gate, seed cargo |
| 5. Rừng Mưa Thì Thầm | Conditions, branching | Tán lá, cầu rễ, mưa cục bộ | Moisture/IR sensors, patrol drone, hazard zone, bridge switch |
| 6. Sài Gòn Kênh Tương Lai | Functions, route planning | Cầu vượt, bến nổi, skyline và kênh hư cấu | Conveyor, cargo arm, signal grid, lift gate |
| 7. Cao Nguyên Gió Máy | Parallelism, calibration | Tua-bin, đồi đá, trạm quan sát | Wind vane, turbine brake, drone, multi-step arm |
| 8. Quỹ Đạo Xưởng Mở | Capstone, multi-sensor | Dock quỹ đạo do học sinh xây, không gian mở | Cargo arm, conveyor, airlock gate, beacon, cooperative robot |

Mission kit dùng chung mesh/material/interaction contract. Props tạo bối cảnh có thể đổi skin theo world, nhưng màu và biểu tượng affordance không đổi. Số lượng object tương tác vừa đủ để code là trọng tâm.

### Competition Arena

Arena là sân modular trong một xưởng sáng, có track layout thay phiên và branding riêng; khán đài/screen dùng geometry thấp và atlas, crowd là cards/instances hoặc tắt ở low tier. Ba camera mode: **Follow** theo robot; **Top-down tactical** đọc đường; **Broadcast** chuyển giữa wide shot, close-up objective và replay marker. Chuyển cảnh không giật và không làm mất trạng thái thi đấu.

Overlay livestream hiển thị tên người chơi, đội, lap/mission progress, score, timer, current code block (nếu chủ giải cho phép), sensor readout và leaderboard. Replay lưu command/input log + seed/layout/version; server phát lại trên fixed timestep và so checksum state/event. Client camera có thể nội suy để nhìn mượt nhưng không là nguồn chấm điểm. Có slow motion/instant replay từ log; tournament cần server authoritative, rate limits và protocol/version rõ.

## 5. Signature “wow” moments

| Moment | Trải nghiệm | Technical approach | Cost |
|---|---|---|---|
| 1. Code thành đường hologram | Trước Run, waypoint/path hiện trên sàn và highlight step-by-step | Compiler emit preview actions; GPU line/tube đơn giản, no postprocessing bắt buộc | M |
| 2. Sensor X-ray | Khi hover block sensor, cone/range và vật thể đọc được highlight | Lấy sensor config từ cùng runtime; overlay mesh trong suốt có giới hạn | S |
| 3. “Why stuck?” replay | Chạy chậm đoạn robot mắc, timeline chỉ dòng/block và sensor value | Fixed-step event log, scrubber và UI marker | M |
| 4. Perfect run slow-mo | Khi hoàn thành, camera orbit nhẹ và phát khoảnh khắc chính xác | Snapshot/replay segment; giảm tốc camera playback, giữ physics replay deterministic | M |
| 5. Thế giới lắp ráp | Landmark/bridge mở ra khi học sinh hoàn thành cột mốc | State-driven reveal, tween transform/opacity, bật theo sự kiện | M |
| 6. Đồng đội multiplayer race | Hai robot chạy cùng track, ghost trail so sánh đường đi | Server-synced command logs; client interpolation; giới hạn room/player | L |
| 7. Arena broadcast | Switch camera tự động theo objective, overlay timer/score | Camera director theo event và spectator UI riêng | L |
| 8. Tạo decal cá nhân | Vẽ biểu tượng 2D rồi thấy nó trên robot ngay | Canvas texture atlas, giới hạn độ phân giải và moderation/validation | M |
| 9. Digital twin calibration | Chỉnh tốc độ/độ lệch kit thật và thấy robot ảo thay đổi | Calibration wizard nhập telemetry; profile versioned | L |
| 10. AR tabletop trên phone | Đặt sân mini lên bàn, robot ảo chạy cạnh robot thật | WebXR hit-test/AR where supported; fallback camera overlay hoặc 3D viewer | L |

Ưu tiên 1, 2, 3, 5 cho MVP/v1. Multiplayer, broadcast nâng cao và AR đòi hỏi backend/device testing; không để các hiệu ứng hậu kỳ thành điều kiện để trải nghiệm tốt.

## 6. Technical 3D pipeline

### Asset workflow

1. Blockout bằng primitive trong scene; duyệt kích thước, camera framing, gameplay readability.
2. Model Blender theo modular kit, origin/pivot có quy ước, apply transforms, naming sockets/collision proxy/LOD.
3. UV atlas và material families; bake AO/curvature/lightmap khi phù hợp. Không bake ánh sáng động lên robot/mission state.
4. Export GLB glTF 2.0; pipeline validate scale, normals, material count, UV, bounds, triangle count và license/source.
5. Compress textures sang KTX2/Basis Universal; geometry dùng Meshopt hoặc Draco sau benchmark. Giữ manifest và fallback path nếu decoder không tải được. Chỉ chọn một geometry compression mặc định cho từng class asset để tránh decode/chất lượng khó đoán.
6. Import qua asset registry typed; preload theo mission, dispose đúng vòng đời và có placeholder nhanh.

### Runtime practices

- Instancing cho foliage, bolts, crowd, props lặp; static batching/baked geometry cho diorama; cull xa bằng bounds và world partition.
- LOD0/1/2 theo projected size: hero robot tối đa 3 LOD; props nhỏ có thể chỉ một mesh/atlas. Hysteresis tránh pop.
- Baked lighting/lightmap cho environment tĩnh, ambient occlusion đơn giản; một directional shadow light trong preset trung/cao. Low dùng contact blob/baked shadow.
- Không dựa vào real-time reflections, SSAO, bloom hay nhiều transparent particle layer. Chất lượng đến từ silhouette, composition, baked color và animation.
- KTX2 texture atlas; ưu tiên 512–1024 cho props/world atlas, 1K hero texture; hạn chế alpha và mip-heavy large textures.
- `frameloop="never"` cho canvas off-screen; lazy-load từng canvas; mọi effect pause theo visibility/reduced motion.

### WebGPU vs WebGL2

WebGL2 là baseline sản phẩm vì phủ browser/device tốt và renderer hiện tại dùng Three/R3F. Có thể thử `three.js WebGPURenderer` như progressive enhancement sau khi kiểm tra phiên bản Three/R3F, feature parity, shader/material support và memory behavior. Chọn backend khi khởi tạo; nếu WebGPU thiếu/hỏng thì khởi tạo WebGL2 mà không mất chức năng gameplay. Không viết gameplay phụ thuộc compute shader/WebGPU; benchmark thật trước khi tăng visual tier.

### Physics determinism / replay

Thi đấu cần fixed timestep (ví dụ 1/60 s), input/command log canonical, seed cho random, cùng physics build/version và event ordering. Server chạy authoritative simulation hoặc tái thực thi verifier; client chỉ gửi lệnh có giới hạn, không gửi kết quả score. Replay lưu version của world/layout, robot profile, physics, command stream, checkpoints/checksum và kết quả. Xác định tolerance/quantization nếu Rapier trên WASM khác platform về floating point; replay mismatch phải bị đánh dấu, không chấm bằng client render. Xác minh determinism cross-browser trước khi mở ranked tournament.

### Performance budgets

Các số dưới là mục tiêu khởi điểm cần benchmark trên thiết bị thật. Hiện trạng `CLAUDE.md` medium khoảng 200–240 draw calls và 150k triangles simulator; cần profile để giảm cho low tier.

| Tier | Thiết bị mục tiêu | Draw calls (gameplay) | Visible triangles | GPU texture resident | FPS mục tiêu |
|---|---|---:|---:|---:|---:|
| Low | Chromebook/PC học đường cũ, Android phổ thông | ≤100 | ≤60k | ≤96 MB | 30 ổn định tối thiểu; 60 ở scene gọn |
| Medium | Laptop tích hợp, Chromebook mới, mid Android | ≤160 | ≤110k | ≤192 MB | 60 mục tiêu |
| High | PC/laptop GPU tốt | ≤240 | ≤180k | ≤384 MB | 60+ |

Budgets tính toàn scene nhìn thấy, gồm robot/mission geometry; postprocessing mục tiêu 0 ở low, tối đa một pass nhẹ ở high. Mỗi canvas DPR cap theo `CLAUDE.md`: low 1.0, medium 1.25, high 1.5. Arena giảm crowd/FX theo tier. Nếu GPU time vượt ngưỡng, hạ DPR trước khi giảm độ rõ của objective.

**Load targets:** shell tương tác dưới 2 s trên mạng trường bình thường; first playable scene dưới 5 s cold trên laptop/Chromebook mục tiêu (GLB + decoder + environment); mission kế tiếp dưới 2 s khi asset được cache. Lazy-load world, progressive placeholder, nén truyền tải và báo tiến trình thật; đo p75/p95 trên profile mạng/thiết bị, không chỉ localhost.

## 7. Team, estimate và style checklist

### Roles

- **3D Art Director / Product Designer:** silhouette, visual hierarchy, art bible và review cross-screen.
- **Environment/Prop 3D Artist (1–2):** blockout, world kit, hero landmarks, atlas.
- **Character/Technical Artist:** rig, animation states, shader/material budget, Blender export automation, LOD/compression QA.
- **3D/Graphics Engineer:** renderer compatibility, profiling, asset loading, determinism/replay instrumentation.

Một người có thể kiêm role ở giai đoạn MVP, nhưng ownership technical art phải được chỉ định rõ.

### Ước lượng production

Giả định asset kit modular, world có 1 hero landmark, khoảng 12–18 unique environment/mission assets cộng 20–30 biến thể từ kit; ước lượng 3D/TA person-weeks, không gồm curriculum, code gameplay, concept art hoàn chỉnh hay localization.

| Gói | Assets mới/được polish | Ước lượng |
|---|---:|---:|
| Hero robot + rig + 5 expression states | 1 chassis family, 8–12 modules | 4–6 PW |
| Shared mission kit | 15–20 interactive objects, 2–3 LOD patterns | 4–6 PW |
| World MVP (Sân Nắng) | 1 hero landmark + 12–18 assets | 3–5 PW |
| Mỗi world tiếp theo | 1 landmark + 12–18 assets, dùng shared kit | 2–4 PW/world |
| Arena + spectator set | 1 modular arena, 8–12 props/overlays art side | 3–5 PW |
| Pipeline/style guide/QA pass | Export validator, sample scene, docs | 3–5 PW |

Tổng art/TA cho 8 world và Arena khoảng 28–45 person-weeks tùy độ polish và mức tái dùng; không gồm engineering. Làm prototype một world rồi cập nhật estimate theo throughput thật.

### Tools

Blender (model/rig/bake), Three.js/R3F tooling, glTF/GLB validator, gltf-transform (Meshopt/Draco/KTX2), texture authoring như Krita/Substance tùy ngân sách, Git LFS/asset review thumbnails, GPU profiling qua browser devtools/Spector.js và render-info nội bộ. Lưu source `.blend`, export artifact, version, license, author, dimensions, tri count, material count và compression settings.

### Checklist mỗi asset/world

- [ ] Silhouette nhận ra ở thumbnail và camera gameplay.
- [ ] Màu objective khác rõ với scenery; trạng thái không chỉ dựa vào màu.
- [ ] Chất liệu tuân palette/roughness và không dùng chi tiết siêu nhỏ vô ích.
- [ ] Pivot, scale, collision proxy, sockets và orientation được kiểm.
- [ ] Có LOD hoặc lý do rõ ràng vì sao không cần; bounds/culling đúng.
- [ ] Material/texture dùng atlas hoặc shared family; alpha/emission được tiết chế.
- [ ] GLB/KTX2 geometry/texture budgets nằm trong tier mục tiêu.
- [ ] Lighting nhìn tốt ở low (không shadow map) và medium.
- [ ] Robot có thể đi qua/đọc object; sensor visualization không bị che.
- [ ] Reduced motion, color accessibility, localization overlay và screenshot QA đã xem.
- [ ] Source/license/author/export settings ghi vào manifest.

## 8. Roadmap 3D

### MVP — Khóa chất lượng qua vertical slice

- Viết style bible 1 trang + palette/material tokens, silhouette sheet robot và 3D target screenshots.
- Polish một hero robot procedural và garage showroom; giữ mapping phần cứng thật.
- Hoàn thiện Xưởng Sân Nắng với mission kit chuẩn (gate, sensor, cargo, conveyor/arm), một landmark có điểm nhớ.
- Chuẩn hóa GLB export/manifest; đo draw calls, triangles, texture memory trên laptop cũ và Android đại diện.
- Wow moments: hologram path, sensor X-ray, completion replay ngắn.
- **Exit criteria:** visual review nhất quán giữa garage/map/simulator; low tier đạt 30 FPS vững và scene nhẹ đạt 60 FPS mục tiêu; không có asset vượt budget ngoài ngoại lệ được duyệt.

### v1 — Sản phẩm có hành trình và giải đấu

- Ra mắt 4–6 world với shared kit, world-specific landmarks và reusable prop kit.
- Thêm expressions, customization tiers, world reveal moments và preset low/medium/high tinh chỉnh.
- Arena camera/overlays, replay command log và server verifier; chỉ mở ranked sau khi determinism được xác minh.
- Telemetry p75/p95 load/FPS theo device tier; sửa bottleneck trước khi tăng fidelity.
- **Exit criteria:** người học đi từ world 1 đến capstone đầu, nội dung visual đồng bộ, replay kiểm chứng được cùng version.

### v2 — Mở rộng sáng tạo và đa thiết bị

- Đủ 8 world, NPC/rival families và user-created decal/mission cosmetics có guardrails.
- Multiplayer race/broadcast director; tournament production tools và replay share.
- AR tabletop trên thiết bị tương thích, có fallback trải nghiệm browser thường.
- Đánh giá WebGPURenderer bằng benchmark/fallback matrix; chỉ bật cho nhóm browser đã kiểm chứng.
- **Exit criteria:** chất lượng art và hiệu năng được đo trên thiết bị trường thực, AR/WebGPU không làm suy giảm đường chơi WebGL2 cơ bản.

