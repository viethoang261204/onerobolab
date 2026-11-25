import {
  CATEGORIES,
  blockLabel,
  getBlockDef,
  type ArgDef,
  type BlockCategoryId,
  type BlockDef,
  type BlockType,
  type CategoryDef,
  type DropdownOption,
  type SlotDef,
  type TemplatePart,
} from '@robolab/blocks';
import { getLocale, type Locale } from '../i18n/i18n';

export interface BlockViEntry {
  readonly template?: readonly TemplatePart[];
  readonly help?: string;
  readonly keywords?: readonly string[];
  readonly slots?: Readonly<Record<string, string>>;
}

/** Vietnamese category labels (English stays in `@robolab/blocks`). */
export const CATEGORY_LABELS_VI: Readonly<Record<BlockCategoryId, string>> = {
  events: 'Sự kiện',
  movement: 'Di chuyển',
  control: 'Điều khiển',
  sensors: 'Cảm biến',
  logic: 'Logic',
  math: 'Toán học',
  variables: 'Biến',
  functions: 'Hàm',
};

/** Vietnamese display labels for colour dropdown values (internal values stay English). */
export const COLOR_LABELS_VI: Readonly<Record<string, string>> = {
  red: 'đỏ',
  green: 'xanh lá',
  blue: 'xanh dương',
  yellow: 'vàng',
  black: 'đen',
  white: 'trắng',
};

/** Vietnamese display labels for sensor dropdown values (internal values stay English). */
export const SENSOR_LABELS_VI: Readonly<Record<string, string>> = {
  distance: 'khoảng cách',
  line: 'vạch kẻ',
  color: 'màu sắc',
  touch: 'chạm',
};

/** Vietnamese labels for argument names (aria-labels & validation messages). */
export const ARG_LABELS_VI: Readonly<Record<string, string>> = {
  steps: 'số bước',
  distance: 'khoảng cách',
  angle: 'góc xoay',
  speed: 'tốc độ',
  x: 'tọa độ x',
  y: 'tọa độ y',
  time: 'thời gian',
  count: 'số lần lặp',
  'left value': 'giá trị bên trái',
  'right value': 'giá trị bên phải',
  'first number': 'số thứ nhất',
  'second number': 'số thứ hai',
  'smallest number': 'số nhỏ nhất',
  'largest number': 'số lớn nhất',
  value: 'giá trị',
  amount: 'giá trị thay đổi',
  'function name': 'tên hàm',
  button: 'nút',
  sensor: 'cảm biến',
  color: 'màu sắc',
  op: 'phép so sánh',
};

/**
 * Vietnamese translations for every block in `@robolab/blocks`.
 * Keeps `{ arg }` placeholders in the exact same order as the English registry.
 */
export const BLOCKS_VI: Readonly<Record<BlockType, BlockViEntry>> = {
  // Events
  'event.start': {
    template: ['khi bắt đầu chương trình'],
    help: 'Chương trình bắt đầu từ đây. Ghép các khối vào bên dưới.',
    keywords: ['bắt đầu', 'chạy', 'khởi chạy', 'chương trình'],
  },
  'event.button': {
    template: ['khi nhấn nút', { arg: 'button' }],
    help: 'Chạy các khối bên dưới khi nhấn nút trên robot.',
    keywords: ['nút', 'nhấn', 'sự kiện'],
  },
  'event.sensor': {
    template: ['khi cảm biến', { arg: 'sensor' }, 'phát hiện vật'],
    help: 'Chạy các khối bên dưới khi cảm biến phát hiện tín hiệu.',
    keywords: ['cảm biến', 'phát hiện', 'sự kiện'],
  },

  // Movement
  'motion.step': {
    template: ['tiến', { arg: 'steps' }, 'ô'],
    help: 'Tiến theo số ô lưới (1 ô = 60 cm).',
    keywords: ['tiến', 'bước', 'ô', 'lưới', 'di chuyển'],
  },
  'motion.forward': {
    template: ['tiến', { arg: 'distance' }],
    help: 'Đi thẳng về phía trước.',
    keywords: ['tiến', 'đi thẳng', 'di chuyển', 'chạy'],
  },
  'motion.backward': {
    template: ['lùi', { arg: 'distance' }],
    help: 'Lùi thẳng về phía sau.',
    keywords: ['lùi', 'đi lùi', 'di chuyển'],
  },
  'motion.turnLeft': {
    template: ['rẽ trái', { arg: 'angle' }],
    help: 'Xoay sang trái tại chỗ.',
    keywords: ['rẽ trái', 'xoay trái', 'quay trái', 'di chuyển'],
  },
  'motion.turnRight': {
    template: ['rẽ phải', { arg: 'angle' }],
    help: 'Xoay sang phải tại chỗ.',
    keywords: ['rẽ phải', 'xoay phải', 'quay phải', 'di chuyển'],
  },
  'motion.stop': {
    template: ['dừng'],
    help: 'Dừng robot và kết thúc chương trình.',
    keywords: ['dừng', 'kết thúc', 'phanh', 'ngừng'],
  },
  'motion.speed': {
    template: ['đặt tốc độ', { arg: 'speed' }],
    help: 'Chỉnh tốc độ di chuyển của robot (0–100%).',
    keywords: ['tốc độ', 'nhanh', 'chậm', 'di chuyển'],
  },
  'motion.goTo': {
    template: ['đi tới x', { arg: 'x' }, 'y', { arg: 'y' }],
    help: 'Quay về điểm trên bản đồ và đi thẳng tới đó.',
    keywords: ['đi tới', 'tọa độ', 'toạ độ', 'vị trí', 'di chuyển'],
  },
  'action.pick': {
    template: ['nhặt thùng hàng'],
    help: 'Nhặt thùng hàng ngay phía trước robot.',
    keywords: ['nhặt', 'thùng', 'hàng', 'gắp', 'lấy'],
  },
  'action.drop': {
    template: ['thả thùng hàng'],
    help: 'Đặt thùng hàng đang mang xuống phía trước robot.',
    keywords: ['thả', 'đặt', 'giao', 'thùng', 'hàng'],
  },

  // Control
  'control.wait': {
    template: ['đợi', { arg: 'seconds' }],
    help: 'Tạm dừng trước khi chạy khối tiếp theo.',
    keywords: ['đợi', 'chờ', 'tạm dừng', 'giây'],
  },
  'control.repeat': {
    template: ['lặp lại', { arg: 'count' }, 'lần'],
    help: 'Chạy các khối bên trong nhiều lần.',
    keywords: ['vòng lặp', 'lặp', 'lặp lại', 'điều khiển'],
  },
  'control.forever': {
    template: ['lặp mãi mãi'],
    help: 'Chạy các khối bên trong liên tục (cho đến khi gặp khối “thoát vòng lặp”).',
    keywords: ['vòng lặp', 'lặp mãi mãi', 'liên tục', 'vô hạn'],
  },
  'control.while': {
    template: ['lặp khi', { arg: 'condition' }],
    help: 'Chạy các khối bên trong chừng nào điều kiện còn đúng.',
    keywords: ['vòng lặp', 'lặp khi', 'điều kiện'],
  },
  'control.until': {
    template: ['lặp cho đến khi', { arg: 'condition' }],
    help: 'Chạy các khối bên trong cho đến khi điều kiện trở thành đúng.',
    keywords: ['vòng lặp', 'đến khi', 'điều kiện'],
  },
  'control.break': {
    template: ['thoát vòng lặp'],
    help: 'Rời khỏi vòng lặp hiện tại và chạy tiếp các khối phía sau.',
    keywords: ['thoát', 'vòng lặp', 'dừng lặp', 'ngắt'],
  },
  'control.if': {
    template: ['nếu', { arg: 'condition' }, 'thì'],
    help: 'Chỉ chạy các khối bên trong khi điều kiện đúng.',
    keywords: ['nếu', 'điều kiện', 'logic'],
  },
  'control.ifElse': {
    template: ['nếu', { arg: 'condition' }, 'thì'],
    slots: { else: 'không thì' },
    help: 'Chọn chạy một trong hai nhóm khối theo điều kiện.',
    keywords: ['nếu', 'không thì', 'ngược lại', 'điều kiện', 'logic'],
  },

  // Sensors
  'sensor.distance': {
    template: ['khoảng cách (cm)'],
    help: 'Khoảng cách tới vật gần nhất phía trước.',
    keywords: ['cảm biến', 'khoảng cách', 'siêu âm', 'đo'],
  },
  'sensor.line': {
    template: ['thấy vạch kẻ?'],
    help: 'Đúng khi robot đang đi trên vạch kẻ đen.',
    keywords: ['cảm biến', 'vạch kẻ', 'dò đường', 'đường kẻ'],
  },
  'sensor.color': {
    template: ['màu là', { arg: 'color' }, '?'],
    help: 'Đúng khi mặt sàn dưới robot có màu này.',
    keywords: ['cảm biến', 'màu', 'màu sắc', 'sàn', 'đỏ', 'xanh', 'vàng', 'đen', 'trắng'],
  },
  'sensor.obstacle': {
    template: ['có vật cản phía trước?'],
    help: 'Đúng khi có vật cản ở gần ngay phía trước robot.',
    keywords: ['cảm biến', 'vật cản', 'chướng ngại vật', 'va chạm'],
  },
  'sensor.value': {
    template: ['giá trị cảm biến', { arg: 'sensor' }],
    help: 'Số đo thô mà cảm biến đọc được.',
    keywords: ['cảm biến', 'giá trị', 'đọc'],
  },
  'sensor.robotX': {
    template: ['tọa độ x của robot (cm)'],
    help: 'Vị trí của robot theo chiều trái ↔ phải trên bản đồ.',
    keywords: ['cảm biến', 'vị trí', 'tọa độ', 'toạ độ', 'gps'],
  },
  'sensor.robotY': {
    template: ['tọa độ y của robot (cm)'],
    help: 'Vị trí của robot theo chiều dưới ↔ trên trên bản đồ.',
    keywords: ['cảm biến', 'vị trí', 'tọa độ', 'toạ độ', 'gps'],
  },

  // Logic
  'logic.compare': {
    template: [{ arg: 'a' }, { arg: 'op' }, { arg: 'b' }],
    help: 'So sánh hai số.',
    keywords: ['so sánh', 'nhỏ hơn', 'lớn hơn', 'bằng', 'logic'],
  },
  'logic.and': {
    template: [{ arg: 'a' }, 'và', { arg: 'b' }],
    help: 'Đúng khi cả hai điều kiện đều đúng.',
    keywords: ['và', 'logic', 'điều kiện'],
  },
  'logic.or': {
    template: [{ arg: 'a' }, 'hoặc', { arg: 'b' }],
    help: 'Đúng khi ít nhất một điều kiện đúng.',
    keywords: ['hoặc', 'logic', 'điều kiện'],
  },
  'logic.not': {
    template: ['không phải', { arg: 'a' }],
    help: 'Đảo ngược đúng thành sai và sai thành đúng.',
    keywords: ['không phải', 'phủ định', 'đảo', 'logic'],
  },

  // Math
  'math.add': {
    template: [{ arg: 'a' }, '+', { arg: 'b' }],
    help: 'Cộng hai số.',
    keywords: ['cộng', 'tổng', 'toán học'],
  },
  'math.subtract': {
    template: [{ arg: 'a' }, '−', { arg: 'b' }],
    help: 'Trừ hai số.',
    keywords: ['trừ', 'hiệu', 'toán học'],
  },
  'math.multiply': {
    template: [{ arg: 'a' }, '×', { arg: 'b' }],
    help: 'Nhân hai số.',
    keywords: ['nhân', 'tích', 'toán học'],
  },
  'math.divide': {
    template: [{ arg: 'a' }, '÷', { arg: 'b' }],
    help: 'Chia hai số.',
    keywords: ['chia', 'thương', 'toán học'],
  },
  'math.random': {
    template: ['ngẫu nhiên từ', { arg: 'from' }, 'đến', { arg: 'to' }],
    help: 'Chọn một số nguyên ngẫu nhiên trong khoảng.',
    keywords: ['ngẫu nhiên', 'số ngẫu nhiên', 'toán học'],
  },

  // Variables
  'variable.set': {
    template: ['đặt biến', { arg: 'name' }, 'bằng', { arg: 'value' }],
    help: 'Lưu một số vào biến.',
    keywords: ['biến', 'đặt', 'gán', 'lưu'],
  },
  'variable.change': {
    template: ['thay đổi biến', { arg: 'name' }, 'thêm', { arg: 'delta' }],
    help: 'Cộng thêm (hoặc trừ bớt) giá trị cho biến.',
    keywords: ['biến', 'thay đổi', 'tăng', 'giảm', 'cộng'],
  },
  'variable.get': {
    template: [{ arg: 'name' }],
    help: 'Số đang được lưu trong biến.',
    keywords: ['biến', 'lấy', 'giá trị'],
  },
  'mission.value': {
    template: ['nhiệm vụ', { arg: 'key' }],
    help: 'Số liệu mà nhiệm vụ cung cấp cho lượt chạy này.',
    keywords: ['nhiệm vụ', 'dữ liệu', 'tham số', 'mục tiêu'],
  },

  // Functions
  'function.define': {
    template: ['định nghĩa hàm', { arg: 'name' }],
    help: 'Đặt tên cho một nhóm khối. Gọi lại bằng khối “chạy hàm …”.',
    keywords: ['hàm', 'định nghĩa', 'tạo hàm', 'khối riêng'],
  },
  'function.call': {
    template: ['chạy hàm', { arg: 'name' }],
    help: 'Chạy các khối bên trong hàm đã định nghĩa.',
    keywords: ['hàm', 'gọi hàm', 'chạy'],
  },
};

function localizeOptions(name: string, options: readonly DropdownOption[]): readonly DropdownOption[] {
  const table = name === 'color' ? COLOR_LABELS_VI : name === 'sensor' ? SENSOR_LABELS_VI : null;
  if (!table) return options;
  return options.map((o) => ({ value: o.value, label: table[o.value] ?? o.label }));
}

function localizeArgs(args: Readonly<Record<string, ArgDef>>): Readonly<Record<string, ArgDef>> {
  const out: Record<string, ArgDef> = {};
  for (const [name, arg] of Object.entries(args)) {
    if (arg.kind === 'dropdown') {
      out[name] = { ...arg, options: localizeOptions(name, arg.options) };
    } else if (arg.kind === 'number' || arg.kind === 'text') {
      out[name] = { ...arg, label: ARG_LABELS_VI[arg.label] ?? arg.label };
    } else {
      out[name] = arg;
    }
  }
  return out;
}

const viDefCache = new Map<BlockType, BlockDef>();

/** Localized block definition for rendering (template, help, keywords, slot & dropdown labels). */
export function localizedBlockDef(type: BlockType, locale: Locale = getLocale()): BlockDef {
  const base = getBlockDef(type);
  if (locale === 'en') return base;
  const cached = viDefCache.get(type);
  if (cached) return cached;
  const vi = BLOCKS_VI[type];
  const slots: readonly SlotDef[] | undefined = base.slots?.map((s) => ({
    name: s.name,
    label: s.label === null ? null : (vi.slots?.[s.name] ?? s.label),
  }));
  const def: BlockDef = {
    ...base,
    template: vi.template ?? base.template,
    args: localizeArgs(base.args),
    help: vi.help ?? base.help,
    ...(slots && { slots }),
    ...(vi.keywords ? { keywords: vi.keywords } : base.keywords ? { keywords: base.keywords } : {}),
  };
  viDefCache.set(type, def);
  return def;
}

/** Category display name in the active locale. */
export function categoryLabel(id: BlockCategoryId, locale: Locale = getLocale()): string {
  if (locale === 'vi') return CATEGORY_LABELS_VI[id];
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Localized arg display name (used in aria-labels). */
export function localizedArgLabel(label: string, locale: Locale = getLocale()): string {
  return locale === 'vi' ? (ARG_LABELS_VI[label] ?? label) : label;
}

/** Readable block label in the given locale. */
export function localizedBlockLabel(type: BlockType, locale: Locale = getLocale()): string {
  return localizedBlockDef(type, locale)
    .template.filter((p): p is string => typeof p === 'string')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Short block name for logs/messages in the given locale. */
export function localizedBlockName(type: BlockType, locale: Locale = getLocale()): string {
  const first = localizedBlockDef(type, locale).template.find((p): p is string => typeof p === 'string');
  return (first ?? localizedBlockLabel(type, locale)).replace(/[?]/g, '').trim();
}

/** Normalize Vietnamese and English text for accent-insensitive search ("rẽ trái" → "re trai", "đặt" → "dat"). */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bilingual, diacritic-insensitive toolbox search.
 * Matches both Vietnamese (with or without diacritics, e.g. "re trai" → "rẽ trái")
 * and English words (labels, category names, keywords). Excludes `event.start`.
 */
export function searchLocalizedBlocks(query: string): { category: CategoryDef; types: BlockType[] }[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const seen = new Set<BlockType>();
  const out: { category: CategoryDef; types: BlockType[] }[] = [];
  for (const category of CATEGORIES) {
    const types = category.palette.filter((type) => {
      if (type === 'event.start' || seen.has(type)) return false;
      const enDef = getBlockDef(type);
      const viDef = localizedBlockDef(type, 'vi');
      const viEntry = BLOCKS_VI[type];
      const haystack = normalizeSearchText(
        [
          blockLabel(type),
          category.label,
          ...(enDef.keywords ?? []),
          localizedBlockLabel(type, 'vi'),
          CATEGORY_LABELS_VI[category.id],
          ...(viEntry.keywords ?? []),
          viDef.help,
          ...(viEntry.slots ? Object.values(viEntry.slots) : []),
        ].join(' '),
      );
      return haystack.includes(q);
    });
    types.forEach((t) => seen.add(t));
    if (types.length) out.push({ category, types });
  }
  return out;
}
