import { useId, type ReactNode } from 'react';
import { Switch } from '@base-ui/react/switch';
import { Toolbar } from '@base-ui/react/toolbar';
import { Tooltip } from '@base-ui/react/tooltip';

// Deliberately a group, not a <label>. These fields wrap several controls at
// once (the symbol tabs plus their grid, the layer list), and clicking a
// label's dead space forwards the click to its first labelable descendant.
// That made a miss in the symbol grid re-click the first tab, and a miss in
// the layer list select the top layer.
export function Field({ children, label }: { children: ReactNode; label: string }) {
  const labelId = useId();
  return (
    <div className="field" role="group" aria-labelledby={labelId}>
      <span id={labelId}>{label}</span>
      {children}
    </div>
  );
}

export function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <Switch.Root checked={checked} className="switch" onCheckedChange={onChange}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </label>
  );
}

export function ToolButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Toolbar.Button />} className="icon-button" aria-label={label} onClick={onClick}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8}>
          <Tooltip.Popup className="tooltip">
            <Tooltip.Arrow className="tooltip-arrow" />
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
