import test from 'node:test';
import assert from 'node:assert/strict';

import { getShowcaseStyle, SHOWCASE_STYLE } from '../../src/utils/showcaseStyle.js';
import { validateLocaleContent } from '../../src/utils/localeValidator.js';

test('getShowcaseStyle uses explicit style when provided', () => {
  const showcase = {
    style: 'carousel',
    pillarButtons: [{ name: 'Ignored', path: '#pillar01' }],
  };

  const style = getShowcaseStyle(showcase);
  assert.equal(style, SHOWCASE_STYLE.CAROUSEL);
});

test('getShowcaseStyle falls back to legacy pillarButtons signal', () => {
  const showcase = {
    pillarButtons: [{ name: 'Go', path: '#pillar01' }],
  };

  const style = getShowcaseStyle(showcase);
  assert.equal(style, SHOWCASE_STYLE.PILLARS);
});

test('validator allows carousel style even when pillarButtons exist', () => {
  const content = {
    common: {
      showcases: [
        {
          style: 'carousel',
          title: 'Carousel example',
          subtitle: 'A regular showcase',
          pillarButtons: [{ name: 'Not used', path: '#pillar01' }],
        },
      ],
    },
  };

  const result = validateLocaleContent(JSON.stringify(content), 'en');
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('validator enforces pillars-required fields in pillars style', () => {
  const content = {
    common: {
      showcases: [
        {
          style: 'pillars',
          title: 'Pillars example',
          subtitle: '',
          pillarButtons: [{ name: 'Pillar 01', path: '#pillar01' }],
          pillars: [],
        },
      ],
    },
  };

  const result = validateLocaleContent(JSON.stringify(content), 'en');
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.field.includes('.subtitle')));
  assert.ok(result.errors.some((error) => error.field.includes('.pillars')));
});

test('validator rejects partial diagram field groups in pillars style', () => {
  const content = {
    common: {
      showcases: [
        {
          style: 'pillars',
          title: 'Pillars example',
          subtitle: 'Has subtitle',
          pillarButtons: [{ name: 'Pillar 01', path: '#pillar01' }],
          pillars: [
            {
              number: '01',
              label: 'Foundation',
              title: 'First pillar',
              subTitle: 'Subtitle',
              description: 'Description',
              tools: 'Tool A',
              bullets: [{ title: 'Bullet', description: 'Detail' }],
            },
          ],
          diagramTitle: 'Only one diagram field',
        },
      ],
    },
  };

  const result = validateLocaleContent(JSON.stringify(content), 'en');
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.field.includes('.diagram*')));
});

test('validator flags invalid explicit style values', () => {
  const content = {
    common: {
      showcases: [
        {
          style: 'timeline',
          title: 'Unknown style',
          subtitle: 'Still renders as carousel fallback',
        },
      ],
    },
  };

  const result = validateLocaleContent(JSON.stringify(content), 'en');
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.field.includes('.style')));
});
