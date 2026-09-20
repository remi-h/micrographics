import type { CanvasItem, Template } from '../../types';
import { CareLabelTemplate } from './CareLabelTemplate';
import { ExplodedTemplate } from './ExplodedTemplate';
import { IndexPlateTemplate } from './IndexPlateTemplate';
import { LevelsTemplate } from './LevelsTemplate';
import { ManifestoTemplate } from './ManifestoTemplate';
import { PlateTwoTemplate } from './PlateTwoTemplate';
import { QuietTemplate } from './QuietTemplate';
import { SurveyTemplate } from './SurveyTemplate';

export const templateComponents: Record<Exclude<Template, 'blank'>, () => CanvasItem[]> = {
  '001': QuietTemplate,
  '002': IndexPlateTemplate,
  '003': PlateTwoTemplate,
  '004': ManifestoTemplate,
  '005': LevelsTemplate,
  '006': CareLabelTemplate,
  '007': SurveyTemplate,
  '008': ExplodedTemplate,
};
