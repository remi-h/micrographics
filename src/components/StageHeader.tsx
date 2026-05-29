import { ZoomIn, ZoomOut } from 'lucide-react';
import type { Palette, Settings } from '../types';

export function StageHeader({
  canvasZoom,
  grid,
  palette,
  paletteIndex,
  palettes,
  selectedTemplateName,
  settings,
  onChangeGrid,
  onChangePalette,
  onResetZoom,
  onZoomIn,
  onZoomOut,
}: {
  canvasZoom: number;
  grid: boolean;
  palette: Palette;
  paletteIndex: number;
  palettes: Palette[];
  selectedTemplateName: string | undefined;
  settings: Settings;
  onChangeGrid: (value: boolean) => void;
  onChangePalette: (index: number) => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="stage-header">
      <div>
        <span className="eyebrow">Template / {settings.template === 'blank' ? 'Scratch canvas' : selectedTemplateName}</span>
        <h2>{palette.name}</h2>
      </div>
      <div className="stage-actions">
        <div className="stage-palette-list" aria-label="Color palette">
          {palettes.map((item, index) => (
            <button
              aria-label={item.name}
              className="stage-palette-button"
              data-active={index === paletteIndex}
              key={item.name}
              onClick={() => onChangePalette(index)}
              title={item.name}
              type="button"
            >
              <span className="single-swatch" style={{ background: item.ink }} aria-hidden="true" />
            </button>
          ))}
        </div>
        <label className="stage-toggle">
          <span>Grid</span>
          <input checked={grid} onChange={(event) => onChangeGrid(event.target.checked)} type="checkbox" />
        </label>
        <button className="icon-button" onClick={onZoomOut} title="Zoom out" type="button">
          <ZoomOut size={17} aria-hidden="true" />
        </button>
        <button className="zoom-value" onClick={onResetZoom} title="Reset zoom" type="button">
          {Math.round(canvasZoom * 100)}%
        </button>
        <button className="icon-button" onClick={onZoomIn} title="Zoom in" type="button">
          <ZoomIn size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
