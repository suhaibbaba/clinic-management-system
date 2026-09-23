import { localizeInstants } from "@api/ai/tools/ai-tool";

describe("what the model reads of a time", () => {
  it("turns every UTC instant into the clinic's own wall clock, however deep", () => {
    expect(
      localizeInstants(
        {
          startsAt: "2026-09-24T07:00:00.000Z",
          items: [{ at: "2026-09-23T21:30:00Z" }],
          date: "2026-09-24",
          reason: "10:00",
          count: 3,
          missing: null,
        },
        "Asia/Hebron",
      ),
    ).toEqual({
      startsAt: "2026-09-24 10:00",
      items: [{ at: "2026-09-24 00:30" }],
      date: "2026-09-24",
      reason: "10:00",
      count: 3,
      missing: null,
    });
  });
});
