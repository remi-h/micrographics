const symbolLabelOverrides: Record<string, string> = {
  android: 'Android',
  ce: 'CE',
  chatgpt: 'ChatGPT',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'creative-commons': 'Creative Commons',
  deepseek: 'DeepSeek',
  figma: 'Figma',
  github: 'GitHub',
  'github-copilot': 'GitHub Copilot',
  ios: 'iOS',
  kiro: 'Kiro',
  macos: 'macOS',
  mc: 'MC',
  mistral: 'Mistral AI',
  nextjs: 'Next.js',
  opentui: 'OpenTUI',
  react: 'React',
};

export function formatSymbolLabel(mark: string) {
  return (
    symbolLabelOverrides[mark] ??
    mark
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}
