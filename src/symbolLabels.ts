const symbolLabelOverrides: Record<string, string> = {
  android: 'Android',
  'airplay-audio': 'AirPlay Audio',
  'airplay-video': 'AirPlay Video',
  apple: 'Apple',
  'app-store': 'App Store',
  bluetooth: 'Bluetooth',
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
  bleach: 'Bleach',
  'do-not-bleach': 'Do Not Bleach',
  'do-not-wash': 'Do Not Wash',
  dotnet: '.NET',
  'dry-clean': 'Dry Clean',
  figma: 'Figma',
  flutter: 'Flutter',
  github: 'GitHub',
  'github-copilot': 'GitHub Copilot',
  'google-cloud': 'Google Cloud',
  'hang-dry': 'Hang Dry',
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
  'tumble-dry': 'Tumble Dry',
  typescript: 'TypeScript',
  wash: 'Wash',
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
