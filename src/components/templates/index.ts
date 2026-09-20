import type { CanvasItem, Template } from '../../types';
import { AssemblyGuideTemplate } from './AssemblyGuideTemplate';
import { CertificationTemplate } from './CertificationTemplate';
import { FieldSampleTemplate } from './FieldSampleTemplate';
import { FrequencyBandTemplate } from './FrequencyBandTemplate';
import { MaterialSpecTemplate } from './MaterialSpecTemplate';
import { PrintProofTemplate } from './PrintProofTemplate';
import { SurveyChartTemplate } from './SurveyChartTemplate';
import { TransitLogTemplate } from './TransitLogTemplate';

export const templateComponents: Record<Exclude<Template, 'blank'>, () => CanvasItem[]> = {
  '001': TransitLogTemplate,
  '002': FieldSampleTemplate,
  '003': MaterialSpecTemplate,
  '004': SurveyChartTemplate,
  '005': PrintProofTemplate,
  '006': FrequencyBandTemplate,
  '007': AssemblyGuideTemplate,
  '008': CertificationTemplate,
};
