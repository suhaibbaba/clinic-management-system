import { UnprocessableEntityException } from "@nestjs/common";

import { MapLinkResolver } from "@api/clinics/map-link.resolver";

describe("MapLinkResolver", () => {
  const resolver = new MapLinkResolver();
  const originalFetch = global.fetch;

  const redirectingTo = (location: string | null): typeof fetch =>
    jest.fn().mockResolvedValue({ headers: { get: () => location } }) as unknown as typeof fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("follows a shortened link to the pair behind it", async () => {
    global.fetch = redirectingTo(
      "https://www.google.com/maps/search/32.317556,+35.028314?entry=tts",
    );

    await expect(resolver.resolve("https://maps.app.goo.gl/ccqcaKuQ8SJT3Yf37")).resolves.toEqual({
      latitude: "32.317556",
      longitude: "35.028314",
    });
  });

  it("asks the network for nothing when the link already carries the pair", async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(resolver.resolve("https://maps.google.com/?q=32.221,35.254")).resolves.toEqual({
      latitude: "32.221",
      longitude: "35.254",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["a private address", "https://192.168.1.1/"],
    ["plain http", "http://maps.app.goo.gl/abc"],
    ["any other host", "https://example.com/maps?q=1,2"],
    ["not a link at all", "nonsense"],
  ])("refuses %s", async (_name, url) => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(resolver.resolve(url)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses a redirect that leaves the allowed hosts", async () => {
    global.fetch = redirectingTo("https://example.com/whatever");

    await expect(resolver.resolve("https://maps.app.goo.gl/abc")).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it("gives up rather than following a redirect loop for ever", async () => {
    global.fetch = redirectingTo("https://maps.app.goo.gl/again");

    await expect(resolver.resolve("https://maps.app.goo.gl/abc")).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });

  it("gives up when a hop stops redirecting without a pair", async () => {
    global.fetch = redirectingTo(null);

    await expect(resolver.resolve("https://maps.app.goo.gl/abc")).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
