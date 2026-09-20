import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function SurveyChartTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('004'),
    textItem('004-eyebrow', 'SURVEY CHART', 140, 150, 15),
    textItem('004-headline', 'GLOBAL\nDATUM', 140, 290, 50),
    ruleLine('004-rule-head', 140, 400, 560),
    textItem('004-cap-1', 'COORDINATES', 140, 450, 14),
    textItem('004-val-1', "51.5072N 0.1276W", 140, 510, 24),
    textItem('004-cap-2', 'PROJECTION', 140, 590, 14),
    textItem('004-val-2', 'MERC. 04', 140, 650, 24),
    symbolItem('004-icon-world', 'world', 760, 530, 170),
    textItem('004-cap-world', 'REGION', 760, 630, 14),
    ruleLine('004-rule-foot', 140, 700, 400),
    textItem('004-footer', 'SURVEYED AT SEA LEVEL DATUM', 140, 745, 14),
    textItem('004-edition', 'N°04', 980, 705, 28),
  ];
}
