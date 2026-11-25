import type { Locale } from '../../features/i18n/i18n';

/** Target for a tour step: a `data-tour` element, or the robot on screen. */
export type TourTarget = 'robot' | 'toolbox' | 'editor' | 'test' | 'brief' | 'run' | 'camera' | 'mission' | 'edit';

export interface StepText {
  readonly title: string;
  readonly body: string;
}

export interface TourStep extends StepText {
  readonly target: TourTarget;
  /** Vietnamese text (the product language; the English above is the reference). */
  readonly vi: StepText;
}

/** One tour per screen: Code Studio (write the program) and Simulator (test it). */
export type TourId = 'studio' | 'simulator';

/** First-visit tours (content, not code — edit freely). */
export const ONBOARDING_TOURS: Readonly<Record<TourId, readonly TourStep[]>> = {
  studio: [
    {
      target: 'brief',
      title: 'Read your mission',
      body: 'The objectives and hints for this mission live here.',
      vi: { title: 'Đọc nhiệm vụ', body: 'Mục tiêu và gợi ý của nhiệm vụ nằm ở đây.' },
    },
    {
      target: 'toolbox',
      title: 'Pick blocks',
      body: 'Every block your robot understands. Drag one onto the canvas.',
      vi: { title: 'Chọn khối', body: 'Mọi khối lệnh robot hiểu được. Kéo (hoặc chạm) một khối để thêm vào chương trình.' },
    },
    {
      target: 'editor',
      title: 'Build your program',
      body: 'Snap blocks under “when program starts” — they run from top to bottom.',
      vi: { title: 'Lắp chương trình', body: 'Gắn các khối dưới “khi chương trình bắt đầu” — chúng chạy từ trên xuống dưới.' },
    },
    {
      target: 'test',
      title: 'Test in the simulator',
      body: 'When you are ready, send your program to the 3D simulator.',
      vi: { title: 'Chạy thử mô phỏng', body: 'Khi đã sẵn sàng, gửi chương trình sang mô phỏng 3D.' },
    },
  ],
  simulator: [
    {
      target: 'robot',
      title: 'This is your robot',
      body: 'Rover drives, turns and senses the world. Your program controls every move.',
      vi: { title: 'Đây là robot của bạn', body: 'Robot biết chạy, rẽ và cảm nhận thế giới. Chương trình của bạn điều khiển mọi bước đi.' },
    },
    {
      target: 'run',
      title: 'Press Run',
      body: 'Run executes your program. Stop pauses it, Reset puts the robot back.',
      vi: { title: 'Bấm Chạy', body: 'Chạy để thực hiện chương trình. Dừng để ngưng lại, Đặt lại để đưa robot về chỗ xuất phát.' },
    },
    {
      target: 'mission',
      title: 'Complete the mission',
      body: 'Tick off every objective to finish the mission and earn stars.',
      vi: { title: 'Hoàn thành nhiệm vụ', body: 'Đạt mọi mục tiêu để xong nhiệm vụ và nhận sao.' },
    },
    {
      target: 'camera',
      title: 'Look around',
      body: 'Drag to orbit, right-drag to pan, scroll to zoom — or pick a camera view.',
      vi: { title: 'Nhìn quanh', body: 'Kéo để xoay, kéo hai ngón (hoặc chuột phải) để di chuyển, chụm/cuộn để phóng to — hoặc chọn góc camera.' },
    },
    {
      target: 'edit',
      title: 'Change your program',
      body: 'Go back to Code Studio any time. Your program is kept.',
      vi: { title: 'Sửa chương trình', body: 'Quay lại Xưởng Code bất cứ lúc nào. Chương trình của bạn vẫn được giữ.' },
    },
  ],
};

/** A step's text in a locale. */
export const stepText = (step: TourStep, locale: Locale): StepText => (locale === 'vi' ? step.vi : step);
