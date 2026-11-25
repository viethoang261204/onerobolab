import { defineMessages } from '../i18n/i18n';

/** World Map (`/world`) UI, status badges, journey rail, labels and world details. */
export const worldMapMessages = defineMessages({
  en: {
    // Page & loading
    loadingMap: 'Loading the world map',
    mapAria: 'World map',
    canvasAria: 'OneRoboLab world map',
    mapErrorTitle: 'The world map could not be shown',
    hintClickWorld: 'Click a world',
    hintDragZoom: 'Drag to look around · scroll to zoom',
    islandAlt: (p: { name: string }) => `${p.name} island`,

    // World & level status labels
    worldStatusComingSoon: 'Coming soon',
    worldStatusLocked: 'Locked',
    worldStatusAvailable: 'Ready to start',
    worldStatusInProgress: 'In progress',
    worldStatusCompleted: 'Completed',
    levelStatusLocked: 'Locked',
    levelStatusAvailable: 'Ready',
    levelStatusInProgress: 'In progress',
    levelStatusCompleted: 'Completed',

    // World lock reasons
    comingSoonReason: 'New missions for this world are being built.',
    lockedWorldReason: (p: { prev: string }) => `Finish every mission in ${p.prev} to unlock.`,
    previousWorldFallback: 'the previous world',
    missionPhrase: 'this mission',
    worldPhrase: 'this world',

    // Journey list
    worldsNavAria: 'Worlds',
    yourJourney: 'Your journey',
    missionsProgress: (p: { completed: number; total: number }) => `${p.completed} / ${p.total} missions`,
    currentBadge: 'Current',
    worldItemAria: (p: { order: number; name: string; status: string; completed: number; total: number; current: boolean }) =>
      `World ${p.order}: ${p.name}, ${p.status}${p.total ? `, ${p.completed} of ${p.total} missions` : ''}${p.current ? ', current world' : ''}`,

    // Map labels
    worldLabelsAria: 'World labels',
    islandTagAria: (p: { order: number; name: string; detail: string }) => `World ${p.order}: ${p.name}. ${p.detail}`,
    missionsCompleteOf: (p: { completed: number; total: number }) => `${p.completed} of ${p.total} missions complete`,

    // World detail panel
    worldDetailsAria: (p: { name: string }) => `${p.name} details`,
    worldOrder: (p: { order: number }) => `World ${p.order}`,
    closeDetailsAria: 'Close world details',
    progress: 'Progress',
    progressAria: (p: { name: string }) => `${p.name} progress`,
    noMissionsYet: 'No missions yet',
    difficulty: 'Difficulty',
    rewards: 'Rewards',
    xpReward: (p: { xp: string }) => `+${p.xp} XP`,
    skills: 'Skills',
    nextMission: 'Next mission',
    enterWorld: 'Enter World',
  },
  vi: {
    // Page & loading
    loadingMap: 'Đang tải bản đồ thế giới',
    mapAria: 'Bản đồ thế giới',
    canvasAria: 'Bản đồ thế giới OneRoboLab',
    mapErrorTitle: 'Không thể hiển thị bản đồ thế giới',
    hintClickWorld: 'Chọn một thế giới',
    hintDragZoom: 'Kéo để di chuyển · cuộn để phóng to/nhỏ',
    islandAlt: (p) => `Đảo ${p.name}`,

    // World & level status labels
    worldStatusComingSoon: 'Sắp ra mắt',
    worldStatusLocked: 'Đã khoá',
    worldStatusAvailable: 'Sẵn sàng',
    worldStatusInProgress: 'Đang học',
    worldStatusCompleted: 'Hoàn thành',
    levelStatusLocked: 'Đã khoá',
    levelStatusAvailable: 'Sẵn sàng',
    levelStatusInProgress: 'Đang làm',
    levelStatusCompleted: 'Hoàn thành',

    // World lock reasons
    comingSoonReason: 'Các nhiệm vụ mới cho thế giới này đang được xây dựng.',
    lockedWorldReason: (p) => `Hoàn thành tất cả nhiệm vụ ở ${p.prev} để mở khoá.`,
    previousWorldFallback: 'thế giới trước',
    missionPhrase: 'nhiệm vụ này',
    worldPhrase: 'thế giới này',

    // Journey list
    worldsNavAria: 'Danh sách thế giới',
    yourJourney: 'Hành trình',
    missionsProgress: (p) => `${p.completed} / ${p.total} nhiệm vụ`,
    currentBadge: 'Hiện tại',
    worldItemAria: (p) =>
      `Thế giới ${p.order}: ${p.name}, ${p.status}${p.total ? `, ${p.completed}/${p.total} nhiệm vụ` : ''}${p.current ? ', thế giới hiện tại' : ''}`,

    // Map labels
    worldLabelsAria: 'Nhãn thế giới',
    islandTagAria: (p) => `Thế giới ${p.order}: ${p.name}. ${p.detail}`,
    missionsCompleteOf: (p) => `Hoàn thành ${p.completed}/${p.total} nhiệm vụ`,

    // World detail panel
    worldDetailsAria: (p) => `Chi tiết ${p.name}`,
    worldOrder: (p) => `Thế giới ${p.order}`,
    closeDetailsAria: 'Đóng chi tiết thế giới',
    progress: 'Tiến độ',
    progressAria: (p) => `Tiến độ ${p.name}`,
    noMissionsYet: 'Chưa có nhiệm vụ',
    difficulty: 'Độ khó',
    rewards: 'Phần thưởng',
    xpReward: (p) => `+${p.xp} XP`,
    skills: 'Kỹ năng',
    nextMission: 'Nhiệm vụ tiếp theo',
    enterWorld: 'Vào thế giới',
  },
});
