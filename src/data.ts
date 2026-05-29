import { templateComponents } from './components/templates';
import type { CanvasItem, Palette, Settings, Template } from './types';

export const palettes: Palette[] = [
  {
    name: 'Carbon signal',
    background: '#1b1b1b',
    paper: '#101111',
    ink: '#f5f2ea',
    muted: '#f5f2ea',
    accent: '#f5f2ea',
    second: '#f5f2ea',
  },
  {
    name: 'Bone black',
    background: '#f5f2ea',
    paper: '#f8f4ec',
    ink: '#171717',
    muted: '#171717',
    accent: '#171717',
    second: '#171717',
  },
  {
    name: 'Signal red',
    background: '#161616',
    paper: '#101111',
    ink: '#ff4f3d',
    muted: '#ff4f3d',
    accent: '#ff4f3d',
    second: '#ff4f3d',
  },
  {
    name: 'Electric cyan',
    background: '#121717',
    paper: '#0e1111',
    ink: '#55f0dc',
    muted: '#55f0dc',
    accent: '#55f0dc',
    second: '#55f0dc',
  },
];

export const templates: Array<{ id: Template; name: string }> = [
  { id: '006', name: '006 Coordinates' },
  { id: '007', name: '007 Optical' },
  { id: '008', name: '008 Function' },
  { id: '011', name: '011 Ampers' },
  { id: '012', name: '012 Ten Thousand' },
  { id: '013', name: '013 Form Function' },
];

export const marks = [
  'orbit',
  'sun',
  'chevrons',
  'ce',
  'mc',
  'line',
  'semicircle',
  'diamond',
  'tally',
  'triple',
  'eye',
  'flower',
  'badge',
  'asterisk',
  'umbrella',
  'layers',
  'info',
  'quarter',
  'spark',
  'target',
  'warning',
  'bracket',
  'waves',
  'arch',
  'fingerprint',
  'expand',
  'triad',
  'swapbox',
  'nodes',
  'arrows',
  'globe',
  'world',
  'barcode',
  'turn',
  'temple',
  'flag',
  'leaf',
  'swirl',
  'camera',
  'grid',
];

export const aiToolMarks = [
  'chatgpt',
  'claude-code',
  'claude',
  'codex',
  'github-copilot',
  'gemini',
  'deepseek',
  'mistral',
  'kiro',
  'cursor',
  'figma',
  'nextjs',
  'react',
  'tailwind',
  'python',
  'javascript',
  'typescript',
  'cpp',
  'dotnet',
  'dart',
  'flutter',
  'swift',
  'npm',
  'bun',
  'opentui',
  'ios',
  'android',
  'macos',
  'google-cloud',
  'cloudflare',
  'github',
  'creative-commons',
];

export const symbolTabs = [
  { id: 'symbols', name: 'Symbols', marks },
  { id: 'ai-tools', name: 'Tech', marks: aiToolMarks },
];

export const initialSettings: Settings = {
  template: '006',
  paletteIndex: 0,
  backgroundImage: null,
  grid: false,
  showBackground: true,
};

export const symbolMarks = Array.from(
  new Set([
    ...marks,
    ...aiToolMarks,
    ...Object.values(templateComponents)
      .flatMap((template) => template())
      .flatMap((item) => (item.kind === 'text' ? [] : [item.mark])),
  ]),
);

export function loadTemplateItems(template: Template): CanvasItem[] {
  if (template === 'blank') return [];
  return templateComponents[template]().map((item) => ({ ...item }));
}
