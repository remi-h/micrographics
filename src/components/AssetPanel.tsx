import { useRef } from 'react';
import { Select } from '@base-ui/react/select';
import { Check, ChevronDown, Trash2, Type } from 'lucide-react';
import { ARTBOARD_PRESETS, artboardPreset, type ArtboardPresetId } from '../lib/artboard';
import type { Artboard } from '../types';
import { Field, ToggleRow } from './Controls';
import { SymbolPicker } from './SymbolPicker';

/** What the Canvas size control can ask for: a preset, or the background's own shape. */
export type ArtboardChoice = ArtboardPresetId | 'background';

// The value the control shows when the frame is not a preset -- a frame
// matched to an uploaded image. It is listed, disabled, whenever it is the
// value: a Select whose value matches none of its items falls back to the
// first one, which would snap a freshly matched frame back to landscape.
const CUSTOM_VALUE = 'custom';

export function AssetPanel({
  activeSymbolMarks,
  activeSymbolTab,
  artboard,
  hasBackground,
  showBackground,
  textDraft,
  onAddSymbol,
  onAddText,
  onChangeArtboard,
  onChangeShowBackground,
  onChangeSymbolTab,
  onChangeTextDraft,
  onRemoveBackground,
  onUploadBackground,
}: {
  activeSymbolMarks: string[];
  activeSymbolTab: string;
  artboard: Artboard;
  hasBackground: boolean;
  showBackground: boolean;
  textDraft: string;
  onAddSymbol: (mark: string) => void;
  onAddText: () => void;
  onChangeArtboard: (choice: ArtboardChoice) => void;
  onChangeShowBackground: (value: boolean) => void;
  onChangeSymbolTab: (tab: string) => void;
  onChangeTextDraft: (value: string) => void;
  onRemoveBackground: () => void;
  onUploadBackground: (file: File | undefined) => void;
}) {
  const preset = artboardPreset(artboard);
  const sizeLabel = `${artboard.width} × ${artboard.height}`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <aside className="asset-panel">
      <div className="asset-panel-inner">
        <Field label="Uploaded background">
          <div className={hasBackground ? 'add-row' : undefined}>
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept="image/*"
              onChange={(event) => onUploadBackground(event.target.files?.[0])}
            />
            {/* Takes the image away and leaves the paper colour, which
                `Include background` cannot do: it hides both. The canvas
                keeps its size, so the layout on it does not move. */}
            {hasBackground && (
              <button
                aria-label="Remove background"
                className="add-button remove-background-button"
                title="Remove background"
                onClick={() => {
                  // Cleared too, or picking the same file again would not
                  // fire a change and the image could not be put back.
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  onRemoveBackground();
                }}
                type="button"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </Field>
        <ToggleRow label="Include background" checked={showBackground} onChange={onChangeShowBackground} />
        <Field label="Canvas size">
          <Select.Root
            value={preset?.id ?? CUSTOM_VALUE}
            onValueChange={(value) => {
              if (value && value !== CUSTOM_VALUE) onChangeArtboard(value as ArtboardChoice);
            }}
          >
            <Select.Trigger className="select-trigger" aria-label="Canvas size">
              <span>{preset ? `${preset.name} · ${sizeLabel}` : `Custom · ${sizeLabel}`}</span>
              <Select.Icon className="select-icon">
                <ChevronDown size={16} aria-hidden="true" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner sideOffset={8}>
                <Select.Popup className="select-popup">
                  {ARTBOARD_PRESETS.map((item) => (
                    <Select.Item className="select-item" key={item.id} value={item.id}>
                      <Select.ItemText>
                        {item.name} · {item.width} × {item.height}
                      </Select.ItemText>
                      <Select.ItemIndicator className="select-item-indicator">
                        <Check size={14} aria-hidden="true" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                  {!preset && (
                    <Select.Item className="select-item" disabled value={CUSTOM_VALUE}>
                      <Select.ItemText>Custom · {sizeLabel}</Select.ItemText>
                      <Select.ItemIndicator className="select-item-indicator">
                        <Check size={14} aria-hidden="true" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  )}
                  {hasBackground && (
                    <Select.Item className="select-item" value="background">
                      <Select.ItemText>Match background</Select.ItemText>
                    </Select.Item>
                  )}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field>
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
