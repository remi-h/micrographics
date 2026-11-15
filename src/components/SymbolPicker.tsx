import { useRef, type ReactNode } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { LogIn, Upload, X } from 'lucide-react';
import { symbolTabs } from '../data';
import type { CustomSymbol } from '../lib/cloud';
import { customMark } from '../lib/customSymbols';
import { formatSymbolLabel } from '../lib/symbolLabels';
import { MicroMark } from './MicroMark';

/** The id of the tab holding the symbols a signed-in user uploaded. */
export const CUSTOM_TAB = 'custom';

/** What the `Custom` tab needs; absent on a deployment without accounts. */
export type CustomSymbols = {
  /** `signedIn` shows the symbols; `signedOut` offers the sign-in in their place. */
  status: 'loading' | 'signedOut' | 'signedIn';
  symbols: CustomSymbol[];
  error: string | null;
  onDelete: (id: string) => void;
  onSignIn: () => void;
  onUpload: (file: File) => void;
};

function SymbolButton({
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
      <Tooltip.Trigger render={<button type="button" />} aria-label={label} className="symbol-button" onClick={onClick}>
        <svg aria-hidden="true" className="symbol-icon" viewBox="0 0 36 36">
          {children}
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
}

function CustomTab({
  custom,
  onAddSymbol,
}: {
  custom: CustomSymbols;
  onAddSymbol: (mark: string, custom?: { svg: string; label: string }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (custom.status !== 'signedIn') {
    return (
      <div className="symbol-custom-empty">
        <p>Upload your own SVG symbols and use them on any canvas.</p>
        {custom.status === 'signedOut' && (
          <button className="add-button" onClick={custom.onSignIn} type="button">
            <LogIn size={16} aria-hidden="true" />
            Sign in with Google
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <input
        accept=".svg,image/svg+xml"
        aria-label="SVG file"
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared, or picking the same file again would not fire a change.
          event.target.value = '';
          if (file) custom.onUpload(file);
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <button className="add-button symbol-upload" onClick={() => fileInputRef.current?.click()} type="button">
        <Upload size={16} aria-hidden="true" />
        Upload SVG
      </button>
      <div className="symbol-custom-note" role="alert">
        {custom.error}
      </div>
      {custom.symbols.length === 0 ? (
        <p className="symbol-custom-hint">Nothing here yet. An uploaded symbol keeps its own colours.</p>
      ) : (
        <div className="symbol-grid">
          {custom.symbols.map((symbol) => (
            <div className="symbol-custom-item" key={symbol.id}>
              <SymbolButton
                label={symbol.name}
                onClick={() => onAddSymbol(customMark(symbol.id), { svg: symbol.svg, label: symbol.name })}
              >
                <MicroMark color="#f4f0e8" mark={customMark(symbol.id)} svg={symbol.svg} x={18} y={18} />
              </SymbolButton>
              {/* Deleting it here takes it out of the tab only: a canvas
                  carries its own copy of every symbol placed on it. */}
              <button
                aria-label={`Delete ${symbol.name}`}
                className="symbol-custom-delete"
                onClick={() => custom.onDelete(symbol.id)}
                title={`Delete ${symbol.name}`}
                type="button"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function SymbolPicker({
  activeSymbolTab,
  custom,
  onAddSymbol,
  onChangeTab,
}: {
  activeSymbolTab: string;
  custom?: CustomSymbols;
  onAddSymbol: (mark: string, custom?: { svg: string; label: string }) => void;
  onChangeTab: (tab: string) => void;
}) {
  const tabs = [...symbolTabs.map(({ id, name }) => ({ id, name })), ...(custom ? [{ id: CUSTOM_TAB, name: 'Custom' }] : [])];
  const showCustom = Boolean(custom) && activeSymbolTab === CUSTOM_TAB;
  const marks = (symbolTabs.find((tab) => tab.id === activeSymbolTab) ?? symbolTabs[0]).marks;

  return (
    <>
      <div className="symbol-tabs" role="tablist" aria-label="Symbol groups">
        {tabs.map((tab) => (
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
      {showCustom && custom ? (
        <CustomTab custom={custom} onAddSymbol={onAddSymbol} />
      ) : (
        <div className="symbol-grid">
          {marks.map((mark) => (
            <SymbolButton key={mark} label={formatSymbolLabel(mark)} onClick={() => onAddSymbol(mark)}>
              <MicroMark color="#f4f0e8" mark={mark} x={18} y={18} />
            </SymbolButton>
          ))}
        </div>
      )}
    </>
  );
}
