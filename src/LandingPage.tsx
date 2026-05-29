import { BrandIcon } from './components/BrandIcon';

const useCases = [
  {
    title: 'Launch visuals',
    body: 'Make a polished poster for a product drop, open source release, or social announcement without opening a design suite.',
  },
  {
    title: 'README headers',
    body: 'Turn a repo, framework, or tool stack into a dense visual identity for GitHub, docs, and project pages.',
  },
  {
    title: 'Deck texture',
    body: 'Create technical backgrounds for slides, case studies, and product notes that need more signal than stock art.',
  },
  {
    title: 'Wallpapers',
    body: 'Build personal or team wallpapers around symbols, text, layouts, and color systems that actually fit the screen.',
  },
];

const steps = [
  'Pick a template or start from scratch',
  'Choose symbols, text, palette, grid and background',
  'Export SVG or PNG for the place you need it',
];

const examples: Array<{
  name: string;
  tone: string;
  image?: string;
  placeholder: string;
}> = [
    {
      name: 'Event system',
      tone: 'Create one visual language for tickets, posters, wristbands, screens, handouts, and other physical or digital touchpoints.',
      image: '/event.png',
      placeholder: 'Event system image',
    },
    {
      name: 'Launch poster',
      tone: 'Make a release visual for a new app, open source project, startup update, or conference announcement.',
      image: '/saas.png',
      placeholder: 'Launch poster image',
    },
    {
      name: 'Product detail mark',
      tone: 'Design small technical markings, care labels, glass decals, and product details that add context without taking over the object.',
      image: '/car-window.png',
      placeholder: 'Product detail image',
    },
  ];

export default function LandingPage() {
  return (
    <>
      <main className="landing-page">
        <section className="landing-hero">
          <nav className="landing-nav" aria-label="Primary">
            <a className="landing-logo" href="#top" aria-label="Micrographics Creator home">
              <BrandIcon />
              <strong>Micrographics Creator</strong>
            </a>
            <div className="landing-nav-links">
              <a href="#examples">Examples</a>
              <a href="#how">How it works</a>
              <a className="landing-nav-primary" href="/creator">Open tool</a>
            </div>
          </nav>

          <div className="landing-hero-content" id="top">
            <p className="landing-kicker">Free SVG and PNG micrographic generator</p>
            <h1>Micrographics Creator</h1>
            <p className="landing-lede">
              Design dense, technical visuals for launches, docs, README headers, wallpapers,
              and social posts in minutes.
            </p>
            <div className="landing-actions">
              <a className="landing-button landing-button-primary" href="/creator">
                Start creating
              </a>
              <a className="landing-button" href="#examples">
                See examples
              </a>
            </div>
            <div className="landing-proof" aria-label="Product highlights">
              <span>Quick start with templates</span>
              <span>Forever free to use</span>
              <span>SVG and PNG export</span>
            </div>
          </div>
        </section>

        <section className="landing-section landing-intro">
          <div>
            <p className="landing-kicker">What it is for</p>
            <h2>Make the visual system around the thing you built.</h2>
          </div>
          <p>
            Micrographics Creator sits between a screenshot, a diagram, and a poster. It gives
            developers, founders, and small teams a fast way to create sharp technical graphics
            that look intentional without spending an afternoon in Figma. It is free to use:
            open the creator, make the visual, and export it.
          </p>
        </section>

        <section className="landing-section" id="examples">
          <div className="landing-section-heading">
            <p className="landing-kicker">Examples</p>
            <h2>Make graphics that look intentional, credible, and ready to publish.</h2>
          </div>
          <div className="landing-example-grid">
            {examples.map((example, index) => (
              <article className="landing-example" key={example.name}>
                <div className="landing-example-art" data-variant={index} aria-hidden="true">
                  {example.image ? <img src={example.image} alt="" /> : <span>{example.placeholder}</span>}
                </div>
                <h3>{example.name}</h3>
                <p>{example.tone}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-heading">
            <p className="landing-kicker">When to use it</p>
            <h2>For the moments where a plain screenshot feels unfinished.</h2>
          </div>
          <div className="landing-card-grid">
            {useCases.map((useCase) => (
              <article className="landing-card" key={useCase.title}>
                <h3>{useCase.title}</h3>
                <p>{useCase.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-how" id="how">
          <div className="landing-section-heading">
            <p className="landing-kicker">How it works</p>
            <h2>Export your visuals in seconds for free forever :)</h2>
          </div>
          <ol className="landing-steps">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="landing-section landing-faq">
          <div className="landing-section-heading">
            <p className="landing-kicker">Details</p>
            <h2>Designed for practical output.</h2>
          </div>
          <div className="landing-faq-list">
            <article>
              <h3>Do I need design skills?</h3>
              <p>No. Start from a template, adjust symbols and text, then export.</p>
            </article>
            <article>
              <h3>What can I export?</h3>
              <p>SVG for editable vector work and PNG for quick sharing.</p>
            </article>
            <article>
              <h3>Who is it for?</h3>
              <p>Developers, indie makers, founders, open source maintainers, and product teams.</p>
            </article>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="landing-footer-brand">
            <a className="landing-logo" href="#top" aria-label="Micrographics Creator home">
              <BrandIcon />
              <strong>Micrographics Creator</strong>
            </a>
            <p>Generate dense technical visuals for launches, docs, portfolios, posters, and product details.</p>
            <p className="landing-footer-copyright">Copyright © 2026 Remi.</p>
          </div>
          <nav className="landing-footer-links" aria-label="Footer">
            <a href="#examples">Examples</a>
            <a href="#how">How it works</a>
            <a href="/creator">Open tool</a>
          </nav>
        </footer>
      </main>

    </>
  );
}
