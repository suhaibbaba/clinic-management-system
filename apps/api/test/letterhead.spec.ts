import { LetterheadService, type Letterhead } from '@api/billing/pdf/letterhead.service';
import type { RtlPdf } from '@api/billing/pdf/pdf-builder';

// A receipt is a legal document with a clinic's name on it. Whatever stands in for a missing logo
// has to be that name and nothing else — a stock mark would put somebody else's brand on it.
describe('the printed letterhead', () => {
  const clinic = (over: Partial<Letterhead> = {}): Letterhead => ({
    name: 'عيادة النور',
    contact: '+963110000000 — دمشق',
    currency: 'ILS',
    language: 'ar',
    logo: null,
    ...over,
  });

  function fakePdf() {
    const drawn: string[] = [];
    const text: string[] = [];

    const pdf = {
      image: async (): Promise<boolean> => {
        drawn.push('image');
        return true;
      },
      text: (value: string) => {
        drawn.push('text');
        text.push(value);
      },
      rule: () => drawn.push('rule'),
    } as unknown as RtlPdf;

    return { pdf, drawn, text };
  }

  const service = new LetterheadService(null as never, null as never);

  it('draws the name and no graphic when the clinic has no logo', async () => {
    const { pdf, drawn, text } = fakePdf();

    await service.draw(pdf, clinic());

    expect(drawn).not.toContain('image');
    expect(text[0]).toBe('عيادة النور');
  });

  it('draws the uploaded logo above the name when there is one', async () => {
    const { pdf, drawn, text } = fakePdf();

    await service.draw(pdf, clinic({ logo: { bytes: Buffer.from([1]), mime: 'image/png' } }));

    expect(drawn[0]).toBe('image');
    expect(text[0]).toBe('عيادة النور');
  });

  it('still carries the name when the bytes are something pdf-lib cannot embed', async () => {
    const { pdf, text } = fakePdf();
    (pdf as unknown as { image: () => Promise<boolean> }).image = async () => false;

    await service.draw(pdf, clinic({ logo: { bytes: Buffer.from([1]), mime: 'image/tiff' } }));

    expect(text[0]).toBe('عيادة النور');
  });
});
