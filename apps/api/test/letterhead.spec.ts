import { LetterheadService, type Letterhead } from "@api/modules/billing/pdf/letterhead.service";
import { PDFDocument } from "pdf-lib";
import { RtlPdf } from "@api/modules/billing/pdf/pdf-builder";

describe("the printed letterhead", () => {
  const clinic = (over: Partial<Letterhead> = {}): Letterhead => ({
    name: "عيادة النور",
    otherName: "Al Nour Clinic",
    address: "دمشق، المزة",
    phone: "+963110000000",
    email: "info@alnour.test",
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

  it("carries the clinic's other name, its email and when the sheet was printed", async () => {
    const { pdf, calls } = capture();

    await service.draw(pdf, clinic(), "كشف حساب");

    expect(calls[0]).toMatchObject({ otherName: "Al Nour Clinic", email: "info@alnour.test" });
    expect(calls[0]?.issued).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(calls[0]?.printed).toMatch(/^طُبع في \u2066\d{2}\/\d{2}\/\d{4} · .+\u2069$/);
  });

  it("keeps the letterhead on every page of a long document", async () => {
    const pdf = await RtlPdf.create();

    await service.draw(pdf, clinic(), "كشف حساب");
    pdf.footer((page, total) => `${page}/${total}`);
    for (let line = 0; line < 120; line += 1) {
      pdf.text(`سطر ${line}`);
    }

    const bytes = await pdf.save();
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
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
