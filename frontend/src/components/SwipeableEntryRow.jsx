import { useCallback, useEffect, useRef, useState } from "react";

const Clamp = (value, min, max) => Math.max(min, Math.min(max, value));

let ActiveCloseRow = null;

const SwipeableEntryRow = ({ children, onEdit, onDelete, Nudge = false }) => {
  const startRef = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [hasNudged, setHasNudged] = useState(false);
  const nudgeTimersRef = useRef([]);
  const maxOffset = 112;
  const commitOffset = 96;
  const startThreshold = 24;

  const closeRow = useCallback(() => {
    setOffset(0);
    setIsSwiping(false);
  }, []);

  useEffect(() => {
    if (offset === 0) {
      if (ActiveCloseRow === closeRow) {
        ActiveCloseRow = null;
      }
      return;
    }
    ActiveCloseRow = closeRow;
    return () => {
      if (ActiveCloseRow === closeRow) {
        ActiveCloseRow = null;
      }
    };
  }, [offset, closeRow]);

  useEffect(() => {
    if (!Nudge || hasNudged) {
      return undefined;
    }
    setHasNudged(true);
    const timers = [];
    const startTimer = window.setTimeout(() => {
      if (isSwiping) {
        return;
      }
      setOffset(18);
      const endTimer = window.setTimeout(() => {
        setOffset(0);
      }, 240);
      timers.push(endTimer);
    }, 420);
    timers.push(startTimer);
    nudgeTimersRef.current = timers;
    return () => {
      nudgeTimersRef.current.forEach((timer) => clearTimeout(timer));
      nudgeTimersRef.current = [];
    };
  }, [Nudge, hasNudged, isSwiping]);

  const handleTouchStart = (event) => {
    if (ActiveCloseRow && ActiveCloseRow !== closeRow) {
      ActiveCloseRow();
    }
    const touch = event.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
    setIsSwiping(false);
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;

    if (!isSwiping) {
      if (Math.abs(dx) < startThreshold || Math.abs(dx) < Math.abs(dy)) {
        return;
      }
      setIsSwiping(true);
    }

    if (event.cancelable) {
      event.preventDefault();
    }
    setOffset(Clamp(dx, -maxOffset, maxOffset));
  };

  const handleTouchEnd = () => {
    if (!isSwiping) {
      return;
    }
    setIsSwiping(false);
    if (Math.abs(offset) < startThreshold) {
      setOffset(0);
      return;
    }
    if (offset > commitOffset) {
      setOffset(0);
      onEdit?.();
      return;
    }
    if (offset < -commitOffset) {
      setOffset(0);
      onDelete?.();
      return;
    }
    setOffset(offset > 0 ? maxOffset : -maxOffset);
  };

  const handleRowClick = () => {
    if (offset !== 0) {
      setOffset(0);
    }
    onEdit?.();
  };

  const handleAction = (action) => {
    closeRow();
    action?.();
  };

  return (
    <div className="entry-swipe">
      <div className="entry-swipe-actions entry-swipe-actions--left">
        <button type="button" onClick={() => handleAction(onEdit)}>
          Edit
        </button>
      </div>
      <div className="entry-swipe-actions entry-swipe-actions--right">
        <button type="button" onClick={() => handleAction(onDelete)}>
          Delete
        </button>
      </div>
      <div
        className={`entry-swipe-content${isSwiping ? " is-swiping" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onEdit?.();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableEntryRow;
