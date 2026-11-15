import {
  MAX_SYMBOL_SVG_LENGTH,
  customMark,
  isCustomMark,
  sanitizeSvg,
  svgDataUri,
  symbolNameFromFile,
} from './customSymbols';

const svg = (inner: string, attributes = 'viewBox="0 0 24 24"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${inner}</svg>`;

function cleaned(source: string) {
  const result = sanitizeSvg(source);
  if (!result.ok) throw new Error(result.error);
  return result.svg;
}

describe('sanitizeSvg', () => {
  it('keeps an ordinary drawing', () => {
    const out = cleaned(svg('<circle cx="12" cy="12" r="10" fill="#e4572e"/>'));
    expect(out).toContain('<circle');
    expect(out).toContain('fill="#e4572e"');
    expect(out).toContain('viewBox="0 0 24 24"');
  });

  it('removes scripts, embedded pages and event handlers', () => {
    const out = cleaned(
      svg(
        '<script>alert(1)</script><foreignObject><iframe src="https://example.com"/></foreignObject>' +
          '<g><rect width="4" height="4" onclick="alert(1)" ONLOAD="x()"/></g>',
        'viewBox="0 0 24 24" onload="alert(1)"',
      ),
    );
    expect(out).not.toMatch(/script|foreignObject|iframe|onclick|onload/i);
    expect(out).toContain('<rect');
  });

  it('removes links out of the file but keeps references into it', () => {
    const out = cleaned(
      svg(
        '<defs><path id="p" d="M0 0h4"/></defs><use href="#p"/>' +
          '<image href="https://example.com/track.png"/>' +
          '<a xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="javascript:alert(1)"><rect width="4" height="4"/></a>',
      ),
    );
    expect(out).toContain('href="#p"');
    expect(out).not.toContain('example.com');
    expect(out).not.toContain('javascript:');
  });

  it('removes an animation that would write a link back in', () => {
    const out = cleaned(svg('<a><set attributeName="href" to="javascript:alert(1)"/><animate attributeName="opacity" to="0"/></a>'));
    expect(out).not.toContain('javascript:');
    expect(out).toContain('attributeName="opacity"');
  });

  it('gives a sized drawing without a viewBox one, so it scales', () => {
    expect(cleaned(svg('<rect/>', 'width="48px" height="32"'))).toContain('viewBox="0 0 48 32"');
    expect(cleaned(svg('<rect/>', 'width="100%" height="32"'))).not.toContain('viewBox');
  });

  it('refuses what is not an SVG', () => {
    expect(sanitizeSvg('not markup at all')).toEqual({ ok: false, error: expect.stringContaining('could not be read') });
    expect(sanitizeSvg('<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>')).toEqual({
      ok: false,
      error: 'That file is not an SVG.',
    });
  });

  it('refuses a file over the limit', () => {
    const result = sanitizeSvg(svg(`<desc>${'x'.repeat(MAX_SYMBOL_SVG_LENGTH)}</desc>`));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('too large') });
  });
});

describe('custom marks', () => {
  it('tells an uploaded symbol from a built-in one', () => {
    expect(isCustomMark(customMark('abc'))).toBe(true);
    expect(isCustomMark('orbit')).toBe(false);
    expect(isCustomMark(undefined)).toBe(false);
  });

  it('names a symbol after its file', () => {
    expect(symbolNameFromFile('team-logo_v2.SVG')).toBe('team logo v2');
    expect(symbolNameFromFile('.svg')).toBe('Symbol');
    expect(symbolNameFromFile(`${'a'.repeat(100)}.svg`)).toHaveLength(60);
  });

  it('encodes a drawing as a data URI an <image> can show', () => {
    const uri = svgDataUri(svg('<text>#1 “quoted”</text>'));
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.split(',')[1])).toContain('#1 “quoted”');
    expect(uri).not.toContain('#');
  });
});
