import React, { useCallback, useEffect, useState } from 'react';
import type { InputManager, TouchAction } from '../../game/controls';
import { VirtualJoystick } from './VirtualJoystick';
import { TouchButton } from './TouchButton';
import './TouchControls.css';

interface TouchControlsProps {
  inputManager: InputManager | null;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ inputManager }) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forceTouch = urlParams?.get('touch') === 'true' || urlParams?.get('mobile') === 'true';

    const hasTouch =
      forceTouch ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    setIsTouchDevice(hasTouch);
  }, []);

  const handleJoystickChange = useCallback(
    (x: number, y: number) => {
      inputManager?.setTouchJoystick(x, y);
    },
    [inputManager]
  );

  const handleButtonPress = useCallback(
    (action: TouchAction, pressed: boolean) => {
      inputManager?.setTouchButton(action, pressed);
    },
    [inputManager]
  );

  if (!isTouchDevice) return null;

  return (
    <div id="touch-controls-overlay" className="touch-controls-overlay">
      {/* Left side: Flight Stick Joystick */}
      <div className="touch-controls-left">
        <VirtualJoystick onChange={handleJoystickChange} />
      </div>

      {/* Right side: Action Buttons Grid */}
      <div className="touch-controls-right">
        {/* Row 1 */}
        <TouchButton
          action="cameraToggle"
          label="CAM"
          sublabel="VIEW"
          color="purple"
          size="small"
          onPress={handleButtonPress}
        />
        <TouchButton
          action="targetLock"
          label="LOCK"
          sublabel="TARGET"
          color="green"
          size="small"
          onPress={handleButtonPress}
        />
        <TouchButton
          action="fireMissile"
          label="MSL"
          sublabel="MISSILE"
          color="amber"
          size="normal"
          onPress={handleButtonPress}
        />

        {/* Row 2 */}
        <TouchButton
          action="airBrake"
          label="BRAKE"
          sublabel="STOP"
          color="grey"
          size="normal"
          onPress={handleButtonPress}
        />
        <TouchButton
          action="boost"
          label="BOOST"
          sublabel="SPEED"
          color="blue"
          size="normal"
          onPress={handleButtonPress}
        />
        <TouchButton
          action="fireGun"
          label="FIRE"
          sublabel="GUN"
          color="red"
          size="large"
          onPress={handleButtonPress}
        />
      </div>
    </div>
  );
};
