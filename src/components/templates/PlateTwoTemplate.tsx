import type { CanvasItem } from '../../types';
import { comb, ruleLine, symbolItem, textItem } from './helpers';

// Archetype: scientific plate. One specimen figure held in the middle of the
// page, numbered callouts with leader rules pointing at it, a measuring comb,
// and a figure caption — the layout of an astronomy or anatomy plate.
export function PlateTwoTemplate(): CanvasItem[] {
  return [
    textItem('003-plate', 'PLATE II', 120, 108, 16),
    textItem('003-side', 'SPECIMEN 44-B', 96, 560, 20, -90),
    symbolItem('003-figure', 'orbit', 400, 400, 300),
    ruleLine('003-lead-1', 612, 286, 72, 11),
    textItem('003-call-1', '01  OUTER SHELL', 700, 292, 18),
    ruleLine('003-lead-2', 612, 406, 72, 11),
    textItem('003-call-2', '02  DECAY BAND', 700, 412, 18),
    ruleLine('003-lead-3', 612, 526, 72, 11),
    textItem('003-call-3', '03  COLLAPSED CORE', 700, 532, 18),
    comb('003-scale', 236, 648, 27, 20),
    textItem('003-scale-label', '0', 236, 690, 13),
    textItem('003-scale-max', '12 CYCLES', 462, 690, 13),
    ruleLine('003-rule', 120, 726, 960),
    textItem('003-caption', 'FIG. 01 - ORBITAL DECAY OBSERVED OVER TWELVE CYCLES', 120, 764, 15),
  ];
}
