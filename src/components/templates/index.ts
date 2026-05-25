import type { CanvasItem, Template } from '../../types';
import { AmpersTemplate } from './AmpersTemplate';
import { CoordinatesTemplate } from './CoordinatesTemplate';
import { FormFunctionTemplate } from './FormFunctionTemplate';
import { FunctionTemplate } from './FunctionTemplate';
import { OpticalTemplate } from './OpticalTemplate';
import { TenThousandTemplate } from './TenThousandTemplate';

export const templateComponents: Record<Exclude<Template, 'blank'>, () => CanvasItem[]> = {
  '006': CoordinatesTemplate,
  '007': OpticalTemplate,
  '008': FunctionTemplate,
  '011': AmpersTemplate,
  '012': TenThousandTemplate,
  '013': FormFunctionTemplate,
};
