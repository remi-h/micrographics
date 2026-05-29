import { Tooltip } from '@base-ui/react/tooltip';
import { symbolTabs } from '../data';
import { formatSymbolLabel } from '../symbolLabels';
import { MicroMark } from './MicroMark';

export function SymbolPicker({
  activeSymbolMarks,
  activeSymbolTab,
  onAddSymbol,
  onChangeTab,
}: {
  activeSymbolMarks: string[];
  activeSymbolTab: string;
  onAddSymbol: (mark: string) => void;
  onChangeTab: (tab: string) => void;
}) {
  return (
    <>
      <div className="symbol-tabs" role="tablist" aria-label="Symbol groups">
        {symbolTabs.map((tab) => (
          <button
            aria-selected={tab.id === activeSymbolTab}
            className="symbol-tab"
            data-active={tab.id === activeSymbolTab}
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div className="symbol-grid">
        {activeSymbolMarks.map((mark) => {
          const label = formatSymbolLabel(mark);
          return (
            <Tooltip.Root key={mark}>
              <Tooltip.Trigger
                render={<button type="button" />}
                aria-label={label}
                className="symbol-button"
                onClick={() => onAddSymbol(mark)}
              >
                <svg aria-hidden="true" className="symbol-icon" viewBox="0 0 36 36">
                  <MicroMark color="#f4f0e8" mark={mark} x={18} y={18} />
                </svg>
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
        })}
      </div>
    </>
  );
}
