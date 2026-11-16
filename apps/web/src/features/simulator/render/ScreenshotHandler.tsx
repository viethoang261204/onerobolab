import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { logToConsole } from '../../../stores/console-store';
import { useUiStore } from '../../../stores/ui-store';

/**
 * Saves a PNG of the 3D view on a `screenshot` camera command. Renders one
 * frame and reads it immediately, so `preserveDrawingBuffer` isn't needed.
 */
export function ScreenshotHandler() {
  const { gl, scene, camera } = useThree();
  const command = useUiStore((s) => s.cameraCommand);

  useEffect(() => {
    if (command?.type !== 'screenshot') return;
    gl.render(scene, camera);
    const link = document.createElement('a');
    link.download = `onerobolab-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.href = gl.domElement.toDataURL('image/png');
    link.click();
    logToConsole('info', 'Screenshot saved.');
  }, [command, gl, scene, camera]);

  return null;
}
