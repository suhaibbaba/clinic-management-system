import { LetterheadService, type Letterhead } from "@api/billing/pdf/letterhead.service";
import { RtlPdf } from "@api/billing/pdf/pdf-builder";

// A receipt is a legal document with a clinic's name on it. Whatever stands in for a missing logo
// has to be that name and nothing else — a stock mark would put somebody else's brand on it.
describe("the printed letterhead", () => {
  const clinic = (over: Partial<Letterhead> = {}): Letterhead => ({
    name: "عيادة النور",
    address: "دمشق، المزة",
    phone: "+963110000000",
    currency: "ILS",
    language: "ar",
    timeZone: "Asia/Damascus",
    logo: null,
    ...over,
  });

  const service = new LetterheadService(null as never, null as never);

  function capture() {
    const calls: Parameters<RtlPdf["letterhead"]>[0][] = [];
    const titles: string[] = [];
    const pdf = {
      letterhead: async (options: Parameters<RtlPdf["letterhead"]>[0]) => {
        calls.push(options);
      },
      title: (value: string) => titles.push(value),
    } as unknown as RtlPdf;

    return { pdf, calls, titles };
  }

  it("heads the sheet with the clinic's own name, contact and the document's title", async () => {
    const { pdf, calls, titles } = capture();

    await service.draw(pdf, clinic(), "إيصال قبض", "#000056");

    // The viewer's tab reads as the document, not as the blob's random name.
    expect(titles).toEqual(["إيصال قبض — #000056 — عيادة النور"]);

    expect(calls[0]).toMatchObject({
      name: "عيادة النور",
      address: "دمشق، المزة",
      phone: "+963110000000",
      title: "إيصال قبض",
      subtitle: "#000056",
      logo: null,
    });
  });

  it("passes the uploaded logo through when there is one", async () => {
    const { pdf, calls } = capture();
    const logo = { bytes: Buffer.from([1]), mime: "image/png" };

    await service.draw(pdf, clinic({ logo }), "كشف حساب");

    expect(calls[0]?.logo).toBe(logo);
  });

  it("still prints the name when the logo is something pdf-lib cannot embed", async () => {
    const pdf = await RtlPdf.create();

    await expect(
      service.draw(
        pdf,
        clinic({ logo: { bytes: Buffer.from([1, 2, 3]), mime: "image/tiff" } }),
        "كشف حساب",
      ),
    ).resolves.toBeUndefined();
    expect((await pdf.save()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
