const symbolLabelOverrides: Record<string, string> = {
  android: 'Android',
  bun: 'Bun',
  ce: 'CE',
  chatgpt: 'ChatGPT',
  'claude-code': 'Claude Code',
  cloudflare: 'Cloudflare',
  codex: 'Codex',
  cpp: 'C++',
  'creative-commons': 'Creative Commons',
  dart: 'Dart',
  deepseek: 'DeepSeek',
  dotnet: '.NET',
  figma: 'Figma',
  flutter: 'Flutter',
  github: 'GitHub',
  'github-copilot': 'GitHub Copilot',
  'google-cloud': 'Google Cloud',
  ios: 'iOS',
  javascript: 'JavaScript',
  kiro: 'Kiro',
  macos: 'macOS',
  mc: 'MC',
  mistral: 'Mistral AI',
  nextjs: 'Next.js',
  npm: 'npm',
  opentui: 'OpenTUI',
  python: 'Python',
  react: 'React',
  swift: 'Swift',
  tailwind: 'Tailwind CSS',
  typescript: 'TypeScript',
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
