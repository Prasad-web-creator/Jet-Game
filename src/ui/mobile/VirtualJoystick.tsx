import React, { useRef, useState, useCallback, useEffect } from 'react';
import './TouchControls.css';

interface VirtualJoystickProps {
  onChange: (x: number, y: number) => void;
  radius?: number;
  label?: string;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onChange,
  radius = 55,
  label = 'PITCH / ROLL',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (touchIdRef.current !== null) return; // already tracking a touch

      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      setIsActive(true);

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      const clampedDist = Math.min(dist, radius);
      const angle = Math.atan2(dy, dx);
      const clampedX = Math.cos(angle) * clampedDist;
      const clampedY = Math.sin(angle) * clampedDist;

      setPosition({ x: clampedX, y: clampedY });
      onChange(clampedX / radius, clampedY / radius);
    },
    [radius, onChange]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (touchIdRef.current === null || !containerRef.current) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchIdRef.current) {
          e.preventDefault();
          const rect = containerRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          const dx = touch.clientX - centerX;
          const dy = touch.clientY - centerY;
          const dist = Math.hypot(dx, dy);

          const clampedDist = Math.min(dist, radius);
          const angle = Math.atan2(dy, dx);
          const clampedX = Math.cos(angle) * clampedDist;
          const clampedY = Math.sin(angle) * clampedDist;

          setPosition({ x: clampedX, y: clampedY });
          onChange(clampedX / radius, clampedY / radius);
          break;
        }
      }
    },
    [radius, onChange]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          setIsActive(false);
          setPosition({ x: 0, y: 0 });
          onChange(0, 0);
          break;
        }
      }
    },
    [onChange]
  );

  useEffect(() => {
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={`virtual-joystick-base ${isActive ? 'virtual-joystick-base--active' : ''}`}
      onTouchStart={handleTouchStart}
    >
      <div className="virtual-joystick-ring">
        <div className="joystick-axis joystick-axis--h" />
        <div className="joystick-axis joystick-axis--v" />
      </div>
      <div
        className="virtual-joystick-knob"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
      >
        <div className="virtual-joystick-knob-inner" />
      </div>
      {label && <span className="virtual-joystick-label">{label}</span>}
    </div>
  );
};
