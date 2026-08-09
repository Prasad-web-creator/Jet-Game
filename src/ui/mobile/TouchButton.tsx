import React, { useState, useCallback } from 'react';
import type { TouchAction } from '../../game/controls';
import './TouchControls.css';

interface TouchButtonProps {
  action: TouchAction;
  label: string;
  sublabel?: string;
  color?: 'red' | 'amber' | 'blue' | 'grey' | 'green' | 'purple';
  size?: 'normal' | 'large' | 'small';
  onPress: (action: TouchAction, pressed: boolean) => void;
}

export const TouchButton: React.FC<TouchButtonProps> = ({
  action,
  label,
  sublabel,
  color = 'blue',
  size = 'normal',
  onPress,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setIsPressed(true);
      onPress(action, true);
    },
    [action, onPress]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setIsPressed(false);
      onPress(action, false);
    },
    [action, onPress]
  );

  return (
    <button
      type="button"
      className={`touch-btn touch-btn--${color} touch-btn--${size} ${isPressed ? 'touch-btn--pressed' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <span className="touch-btn-label">{label}</span>
      {sublabel && <span className="touch-btn-sublabel">{sublabel}</span>}
    </button>
  );
};
