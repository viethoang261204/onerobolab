import { defineMessages } from '../i18n/i18n';

/** Level selection: mission detail dialog, previews, star goals and tool category names. */
export const levelSelectionMessages = defineMessages({
  en: {
    // Star goals
    starComplete: 'Complete the mission',
    starBlocks: (p: { n: number }) => `Use ${p.n} blocks or fewer`,
    starTime: (p: { n: number }) => `Finish within ${p.n} s`,

    // Block category names (Available tools)
    catEvents: 'Events',
    catMovement: 'Movement',
    catControl: 'Control',
    catSensors: 'Sensors',
    catLogic: 'Logic',
    catMath: 'Math',
    catVariables: 'Variables',
    catFunctions: 'Functions',

    // Previews
    previewAlt: (p: { name: string }) => `${p.name} — preview of the mission environment`,
    previewLoading: (p: { name: string }) => `${p.name} — preview loading`,
    coursePreviewAria: (p: { title: string }) => `Course preview: ${p.title}`,

    // LevelDetailPanel
    difficulty: 'Difficulty',
    best: 'Best',
    bestTime: (p: { s: string }) => `${p.s} s`,
    runs: 'Runs',
    previewLegendAria: 'Preview legend',
    legendStart: 'Robot start',
    legendCheckpoint: 'Checkpoint',
    legendGoal: 'Goal',
    legendCone: 'Cone (avoid)',
    missionHeader: (p: { code: string; world: string }) => `Mission ${p.code} · ${p.world}`,
    objectives: 'Objectives',
    objectiveDoneAria: 'done',
    skills: 'Skills',
    availableTools: 'Available tools',
    reward: 'Reward',
    xpReward: (p: { xp: string }) => `+${p.xp} XP`,
    back: 'Back',
    replayMission: 'Replay mission',
    startMission: 'Start Mission',
  },
  vi: {
    // Star goals
    starComplete: 'Hoàn thành nhiệm vụ',
    starBlocks: (p) => `Dùng tối đa ${p.n} khối`,
    starTime: (p) => `Hoàn thành trong ${p.n} giây`,

    // Block category names (Available tools)
    catEvents: 'Sự kiện',
    catMovement: 'Di chuyển',
    catControl: 'Điều khiển',
    catSensors: 'Cảm biến',
    catLogic: 'Logic',
    catMath: 'Toán học',
    catVariables: 'Biến',
    catFunctions: 'Hàm',

    // Previews
    previewAlt: (p) => `${p.name} — hình xem trước môi trường nhiệm vụ`,
    previewLoading: (p) => `${p.name} — đang tải hình xem trước`,
    coursePreviewAria: (p) => `Sơ đồ đường đi: ${p.title}`,

    // LevelDetailPanel
    difficulty: 'Độ khó',
    best: 'Tốt nhất',
    bestTime: (p) => `${p.s} giây`,
    runs: 'Số lần chạy',
    previewLegendAria: 'Chú giải bản đồ thu nhỏ',
    legendStart: 'Điểm xuất phát',
    legendCheckpoint: 'Điểm kiểm tra',
    legendGoal: 'Đích',
    legendCone: 'Cọc tiêu (tránh)',
    missionHeader: (p) => `Nhiệm vụ ${p.code} · ${p.world}`,
    objectives: 'Mục tiêu',
    objectiveDoneAria: 'đã hoàn thành',
    skills: 'Kỹ năng',
    availableTools: 'Công cụ sử dụng',
    reward: 'Phần thưởng',
    xpReward: (p) => `+${p.xp} XP`,
    back: 'Quay lại',
    replayMission: 'Chơi lại nhiệm vụ',
    startMission: 'Bắt đầu nhiệm vụ',
  },
});
