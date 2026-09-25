import { ContextMenu } from '@base-ui/react/context-menu';
import { Group, Ungroup } from 'lucide-react';
import type { ReactNode } from 'react';

// The right-click menu for grouping, shared by the Layers list and the canvas
// so the two cannot offer different things for the same selection.
//
// Grouping used to be a pair of always-visible buttons above the layer list
// and another on the canvas selection toolbar, usually one of them disabled.
// It lives where the thing it acts on is instead: right-click the layers or
// the selection, and the menu offers only what applies. For one whole group
// that is Ungroup, for loose items Group, so it reads as a toggle; both appear
// only when both are real choices (a group selected with other items).
//
// What applies is decided by `groupActions` in groups.ts, from the selection
// as it stands after the right-click has selected its target.

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

export function GroupMenu({
  canGroup,
  canUngroup,
  children,
  className,
  onGroup,
  onUngroup,
}: {
  canGroup: boolean;
  canUngroup: boolean;
  children: ReactNode;
  className?: string;
  onGroup: () => void;
  onUngroup: () => void;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className={className}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="context-menu-positioner">
          <ContextMenu.Popup className="context-menu">
            {canGroup && (
              <ContextMenu.Item className="context-menu-item" onClick={onGroup}>
                <Group size={14} aria-hidden="true" />
                <span className="context-menu-label">Group</span>
                <kbd className="context-menu-shortcut">{MOD}G</kbd>
              </ContextMenu.Item>
            )}
            {canUngroup && (
              <ContextMenu.Item className="context-menu-item" onClick={onUngroup}>
                <Ungroup size={14} aria-hidden="true" />
                <span className="context-menu-label">Ungroup</span>
                <kbd className="context-menu-shortcut">⇧{MOD}G</kbd>
              </ContextMenu.Item>
            )}
            {!canGroup && !canUngroup && (
              // Said rather than left empty, so a right-click on a single item
              // explains how to get to grouping instead of doing nothing.
              <ContextMenu.Item className="context-menu-item" disabled>
                <span className="context-menu-label">Select two or more to group</span>
              </ContextMenu.Item>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
