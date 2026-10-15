import { useEffect, useRef, type ReactNode } from 'react';
interface Props { label: string; icon?: ReactNode; disabled?: boolean; active: boolean; onHold: () => void; onRelease: () => void; }
export default function HoldButton({ label, icon, disabled, active, onHold, onRelease }: Props) {
  const held = useRef(false), release = useRef(onRelease); release.current = onRelease;
  function stop() { if (held.current) { held.current = false; release.current(); } }
  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop); window.addEventListener('blur', stop); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); if (held.current) release.current(); };
  }, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);
  return <button type="button" className="hold-button" disabled={disabled} aria-pressed={active} title="누르고 있는 동안만 비교" onContextMenu={e => e.preventDefault()}
    onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); held.current = true; onHold(); }}
    onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!held.current) { held.current = true; onHold(); } } }}
    onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); } }}>
    {icon}{label}<span className="hold-hint" aria-hidden="true">꾹</span><span className="visually-hidden"> · 누르는 동안만 비교</span>
  </button>;
}
