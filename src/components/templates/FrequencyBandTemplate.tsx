import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function FrequencyBandTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('006'),
    textItem('006-eyebrow', 'FREQUENCY LOG', 140, 150, 15),
    textItem('006-headline', 'SIGNAL\nBAND', 140, 290, 50),
    ruleLine('006-rule-head', 140, 400, 560),
    textItem('006-cap-1', 'RANGE', 140, 450, 14),
    textItem('006-val-1', '20HZ - 20KHZ', 140, 510, 24),
    textItem('006-cap-2', 'CHANNEL', 140, 590, 14),
    textItem('006-val-2', '02', 140, 650, 24),
    symbolItem('006-icon-waves', 'waves', 660, 520, 64),
    textItem('006-cap-waves', 'WAVEFORM', 660, 600, 14),
    symbolItem('006-icon-nodes', 'nodes', 830, 520, 64),
    textItem('006-cap-nodes', 'ARRAY', 830, 600, 14),
    ruleLine('006-rule-foot', 140, 700, 400),
    textItem('006-footer', 'CALIBRATED AGAINST REFERENCE TONE', 140, 745, 14),
    textItem('006-edition', 'N°06', 980, 705, 28),
  ];
}
