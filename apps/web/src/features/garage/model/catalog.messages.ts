import { defineMessages, messagesFor, type Locale } from '../../i18n/i18n';
import type { AccessoryId, AnimationId, DecalId, DecalPlacement, PartId, PatternId, RobotModelId, WheelStyleId } from './robot-config';

/**
 * Display names for the Robot Garage catalog (models, parts, palette colours,
 * combos, patterns, decals, placements, accessories, wheels and animations).
 * Catalog IDs in `catalog.ts` never change.
 */
export const garageCatalogMessages = defineMessages({
  en: {
    // Models
    modelRover: 'Rover',
    roleRover: 'Friendly explorer on four wheels',
    modelScout: 'Scout',
    roleScout: 'Light and fast, tall sensor mast',
    modelTank: 'Tank',
    roleTank: 'Heavy industrial robot on tracks',
    modelBiped: 'Biped',
    roleBiped: 'Humanoid helper that walks and waves',

    // Parts & wheel-section nouns
    partBody: 'Body',
    partHead: 'Head',
    partFrame: 'Frame',
    partPanels: 'Panels',
    partWheels: 'Wheels',
    partLeds: 'LEDs',
    partTurret: 'Turret',
    partTracks: 'Tracks',
    partTorso: 'Torso',
    partArms: 'Arms',
    partLegs: 'Legs',
    partBoots: 'Boots',

    // Palette colours (by hex)
    colorWhite: 'White',
    colorBlack: 'Black',
    colorGray: 'Gray',
    colorNavy: 'Navy',
    colorBlue: 'Blue',
    colorCyan: 'Cyan',
    colorGreen: 'Green',
    colorYellow: 'Yellow',
    colorOrange: 'Orange',
    colorRed: 'Red',
    colorPurple: 'Purple',
    colorPink: 'Pink',

    // Two-tone combos
    comboWhiteCyan: 'White + Cyan',
    comboBlackRed: 'Black + Red',
    comboBlueYellow: 'Blue + Yellow',
    comboPurplePink: 'Purple + Pink',

    // Patterns
    patternNone: 'None',
    patternStripes: 'Stripes',
    patternCamo: 'Camo',
    patternDigital: 'Digital',
    patternCarbon: 'Carbon',
    patternFlame: 'Flame',
    patternCircuit: 'Circuit',
    patternWarning: 'Warning',
    patternGradient: 'Gradient',

    // Decals
    decalLogo: 'Onespace',
    decalStar: 'Star',
    decalLightning: 'Lightning',
    decalRocket: 'Rocket',
    decalShield: 'Shield',
    decalGear: 'Gear',
    decalNumber: 'Number',
    decalInitials: 'Initials',

    // Decal placements
    placeSideLeft: 'Left side',
    placeSideRight: 'Right side',
    placeFront: 'Front',
    placeTop: 'Top',
    placeHead: 'Head',

    // Accessories
    accAntenna: 'Antenna',
    accHeadLight: 'Head Light',
    accFlag: 'Small Flag',
    accSideSensor: 'Sensor Pack',
    accBackpack: 'Explorer Pack',
    accSolarPanel: 'Solar Panel',
    accToolArm: 'Tool Arm',
    accMiniDrone: 'Mini Drone',
    accShield: 'Lava Shield',

    // Wheel styles
    wheelStandardWheels: 'Standard wheels',
    wheelStandardTracks: 'Standard tracks',
    wheelStandardBoots: 'Standard boots',
    wheelAllTerrain: 'Canyon Wheels',
    wheelSnow: 'Snow Tires',

    // Animations
    animIdle: 'Idle',
    animIdleHint: 'Gentle breathing',
    animWave: 'Wave',
    animWaveHint: 'Say hello',
    animScan: 'Scan',
    animScanHint: 'Look around with sensors',
    animCelebrate: 'Celebrate',
    animCelebrateHint: 'Happy hop',
    animDrive: 'Drive',
    animDriveHint: 'Show off the wheels',
    animVictory: 'Victory',
    animVictoryHint: 'Mission complete spin',
  },
  vi: {
    // Models
    modelRover: 'Rover',
    roleRover: 'Robot thám hiểm bốn bánh thân thiện',
    modelScout: 'Scout',
    roleScout: 'Nhẹ, nhanh với cột cảm biến cao',
    modelTank: 'Tank',
    roleTank: 'Robot bánh xích hạng nặng',
    modelBiped: 'Biped',
    roleBiped: 'Robot hình người biết đi và vẫy tay',

    // Parts & wheel-section nouns
    partBody: 'Thân',
    partHead: 'Đầu',
    partFrame: 'Khung',
    partPanels: 'Ốp màu',
    partWheels: 'Bánh xe',
    partLeds: 'Đèn LED',
    partTurret: 'Tháp đầu',
    partTracks: 'Bánh xích',
    partTorso: 'Thân trên',
    partArms: 'Tay',
    partLegs: 'Chân',
    partBoots: 'Giày',

    // Palette colours
    colorWhite: 'Trắng',
    colorBlack: 'Đen',
    colorGray: 'Xám',
    colorNavy: 'Xanh đậm',
    colorBlue: 'Xanh dương',
    colorCyan: 'Xanh ngọc',
    colorGreen: 'Xanh lá',
    colorYellow: 'Vàng',
    colorOrange: 'Cam',
    colorRed: 'Đỏ',
    colorPurple: 'Tím',
    colorPink: 'Hồng',

    // Two-tone combos
    comboWhiteCyan: 'Trắng + Xanh ngọc',
    comboBlackRed: 'Đen + Đỏ',
    comboBlueYellow: 'Xanh dương + Vàng',
    comboPurplePink: 'Tím + Hồng',

    // Patterns
    patternNone: 'Không',
    patternStripes: 'Sọc',
    patternCamo: 'Rằn ri',
    patternDigital: 'Kỹ thuật số',
    patternCarbon: 'Sợi carbon',
    patternFlame: 'Ngọn lửa',
    patternCircuit: 'Mạch điện',
    patternWarning: 'Cảnh báo',
    patternGradient: 'Chuyển sắc',

    // Decals
    decalLogo: 'Onespace',
    decalStar: 'Ngôi sao',
    decalLightning: 'Tia sét',
    decalRocket: 'Tên lửa',
    decalShield: 'Khiên',
    decalGear: 'Bánh răng',
    decalNumber: 'Số',
    decalInitials: 'Chữ cái',

    // Decal placements
    placeSideLeft: 'Bên trái',
    placeSideRight: 'Bên phải',
    placeFront: 'Mặt trước',
    placeTop: 'Mặt trên',
    placeHead: 'Đầu',

    // Accessories
    accAntenna: 'Ăng-ten',
    accHeadLight: 'Đèn pha',
    accFlag: 'Cờ nhỏ',
    accSideSensor: 'Bộ cảm biến',
    accBackpack: 'Ba lô thám hiểm',
    accSolarPanel: 'Pin mặt trời',
    accToolArm: 'Tay công cụ',
    accMiniDrone: 'Drone mini',
    accShield: 'Khiên dung nham',

    // Wheel styles
    wheelStandardWheels: 'Bánh xe tiêu chuẩn',
    wheelStandardTracks: 'Bánh xích tiêu chuẩn',
    wheelStandardBoots: 'Giày tiêu chuẩn',
    wheelAllTerrain: 'Bánh địa hình',
    wheelSnow: 'Lốp đi tuyết',

    // Animations
    animIdle: 'Đứng yên',
    animIdleHint: 'Nhịp thở nhẹ nhàng',
    animWave: 'Vẫy tay',
    animWaveHint: 'Chào hỏi',
    animScan: 'Quét xung quanh',
    animScanHint: 'Quan sát bằng cảm biến',
    animCelebrate: 'Ăn mừng',
    animCelebrateHint: 'Nhảy lên vui sướng',
    animDrive: 'Chạy thử',
    animDriveHint: 'Khoe bánh xe',
    animVictory: 'Chiến thắng',
    animVictoryHint: 'Xoay người mừng thắng',
  },
});

export function modelName(id: RobotModelId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  return { rover: m.modelRover, scout: m.modelScout, tank: m.modelTank, biped: m.modelBiped }[id];
}

export function modelRole(id: RobotModelId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  return { rover: m.roleRover, scout: m.roleScout, tank: m.roleTank, biped: m.roleBiped }[id];
}

export function partLabel(model: RobotModelId, part: PartId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  if (model === 'tank') {
    if (part === 'head') return m.partTurret;
    if (part === 'wheels') return m.partTracks;
  }
  if (model === 'biped') {
    if (part === 'body') return m.partTorso;
    if (part === 'accent') return m.partArms;
    if (part === 'wheels') return m.partLegs;
  }
  return { body: m.partBody, head: m.partHead, trim: m.partFrame, accent: m.partPanels, wheels: m.partWheels, led: m.partLeds }[part];
}

export function wheelSectionLabel(model: RobotModelId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  return model === 'tank' ? m.partTracks : model === 'biped' ? m.partBoots : m.partWheels;
}

export function wheelStyleLabel(id: WheelStyleId, model: RobotModelId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  if (id === 'standard') return model === 'tank' ? m.wheelStandardTracks : model === 'biped' ? m.wheelStandardBoots : m.wheelStandardWheels;
  return id === 'all-terrain' ? m.wheelAllTerrain : m.wheelSnow;
}

export function paletteColorName(hex: string, fallback: string, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  const map: Record<string, string> = {
    '#f3f5fa': m.colorWhite,
    '#1a1d26': m.colorBlack,
    '#64748b': m.colorGray,
    '#223055': m.colorNavy,
    '#2d6bf0': m.colorBlue,
    '#22d3ee': m.colorCyan,
    '#22c55e': m.colorGreen,
    '#facc15': m.colorYellow,
    '#f97316': m.colorOrange,
    '#ef4444': m.colorRed,
    '#8b5cf6': m.colorPurple,
    '#ec4899': m.colorPink,
  };
  return map[hex.toLowerCase()] ?? fallback;
}

export function comboLabel(enName: string, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  const map: Record<string, string> = {
    'White + Cyan': m.comboWhiteCyan,
    'Black + Red': m.comboBlackRed,
    'Blue + Yellow': m.comboBlueYellow,
    'Purple + Pink': m.comboPurplePink,
  };
  return map[enName] ?? enName;
}

export function patternLabel(id: PatternId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  return {
    none: m.patternNone,
    stripes: m.patternStripes,
    camo: m.patternCamo,
    digital: m.patternDigital,
    carbon: m.patternCarbon,
    flame: m.patternFlame,
    circuit: m.patternCircuit,
    warning: m.patternWarning,
    gradient: m.patternGradient,
  }[id];
}

export function decalLabel(id: DecalId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  return {
    logo: m.decalLogo,
    star: m.decalStar,
    lightning: m.decalLightning,
    rocket: m.decalRocket,
    shield: m.decalShield,
    gear: m.decalGear,
    number: m.decalNumber,
    initials: m.decalInitials,
  }[id];
}

export function placementLabel(p: DecalPlacement, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  return {
    'side-left': m.placeSideLeft,
    'side-right': m.placeSideRight,
    front: m.placeFront,
    top: m.placeTop,
    head: m.placeHead,
  }[p];
}

export function accessoryLabel(id: AccessoryId, locale?: Locale): string {
  const m = messagesFor(garageCatalogMessages, locale);
  return {
    antenna: m.accAntenna,
    'head-light': m.accHeadLight,
    flag: m.accFlag,
    'side-sensor': m.accSideSensor,
    backpack: m.accBackpack,
    'solar-panel': m.accSolarPanel,
    'tool-arm': m.accToolArm,
    'mini-drone': m.accMiniDrone,
    shield: m.accShield,
  }[id];
}

export function animationLabel(id: AnimationId, locale?: Locale): { name: string; hint: string } {
  const m = messagesFor(garageCatalogMessages, locale);
  return {
    idle: { name: m.animIdle, hint: m.animIdleHint },
    wave: { name: m.animWave, hint: m.animWaveHint },
    scan: { name: m.animScan, hint: m.animScanHint },
    celebrate: { name: m.animCelebrate, hint: m.animCelebrateHint },
    drive: { name: m.animDrive, hint: m.animDriveHint },
    victory: { name: m.animVictory, hint: m.animVictoryHint },
  }[id];
}
