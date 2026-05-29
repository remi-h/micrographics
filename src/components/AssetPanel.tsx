import { Type } from 'lucide-react';
import { Field, ToggleRow } from './Controls';
import { SymbolPicker } from './SymbolPicker';

export function AssetPanel({
  activeSymbolMarks,
  activeSymbolTab,
  showBackground,
  textDraft,
  onAddSymbol,
  onAddText,
  onChangeShowBackground,
  onChangeSymbolTab,
  onChangeTextDraft,
  onUploadBackground,
}: {
  activeSymbolMarks: string[];
  activeSymbolTab: string;
  showBackground: boolean;
  textDraft: string;
  onAddSymbol: (mark: string) => void;
  onAddText: () => void;
  onChangeShowBackground: (value: boolean) => void;
  onChangeSymbolTab: (tab: string) => void;
  onChangeTextDraft: (value: string) => void;
  onUploadBackground: (file: File | undefined) => void;
}) {
  return (
    <aside className="asset-panel">
      <div className="asset-panel-inner">
        <Field label="Uploaded background">
          <input className="file-input" type="file" accept="image/*" onChange={(event) => onUploadBackground(event.target.files?.[0])} />
        </Field>
        <ToggleRow label="Include background" checked={showBackground} onChange={onChangeShowBackground} />
        <Field label="Symbols">
          <SymbolPicker
            activeSymbolMarks={activeSymbolMarks}
            activeSymbolTab={activeSymbolTab}
            onAddSymbol={onAddSymbol}
            onChangeTab={onChangeSymbolTab}
          />
        </Field>
        <Field label="Text">
          <div className="add-row">
            <input
              className="text-input"
              value={textDraft}
              onChange={(event) => onChangeTextDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onAddText();
                }
              }}
            />
            <button className="add-button" onClick={onAddText} type="button">
              <Type size={16} aria-hidden="true" />
              Add
            </button>
          </div>
        </Field>
      </div>
    </aside>
  );
}
