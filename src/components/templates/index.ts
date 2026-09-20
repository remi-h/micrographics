import type { CanvasItem, Template } from '../../types';
import { CalibrationGridTemplate } from './CalibrationGridTemplate';
import { DigitalLabsTemplate } from './DigitalLabsTemplate';
import { FieldIndexTemplate } from './FieldIndexTemplate';
import { GlobalDeptTemplate } from './GlobalDeptTemplate';
import { GlobalFormTemplate } from './GlobalFormTemplate';
import { MicroLabsTemplate } from './MicroLabsTemplate';
import { PlatformArchTemplate } from './PlatformArchTemplate';
import { SystemArchTemplate } from './SystemArchTemplate';

export const templateComponents: Record<Exclude<Template, 'blank'>, () => CanvasItem[]> = {
  '001': PlatformArchTemplate,
  '002': SystemArchTemplate,
  '003': GlobalDeptTemplate,
  '004': GlobalFormTemplate,
  '005': DigitalLabsTemplate,
  '006': MicroLabsTemplate,
  '007': FieldIndexTemplate,
  '008': CalibrationGridTemplate,
};
