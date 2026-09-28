import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PERFORMED_PROCEDURE_STATUS, type PerformedProcedure } from "@clinic/shared";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { isOptimistic, PATIENT_PROCEDURES_KEY, useCreateProcedure } from "@web/queries/patients";
import { makeCatalogItem, makeProcedure, PATIENT_ID, DOCTOR_ID } from "@test/helpers/fixtures";
import { mockApi } from "@test/helpers/render";

const CATALOG = makeCatalogItem();
const KEY = [PATIENT_PROCEDURES_KEY, PATIENT_ID];

const NEW_PROCEDURE = {
  patientId: PATIENT_ID,
  doctorId: DOCTOR_ID,
  procedureId: CATALOG.id,
  price: "60.00",
  discount: "0.00",
  status: PERFORMED_PROCEDURE_STATUS.DONE,
  chartMarks: [{ chartType: "tooth_fdi" as const, location: { tooth: 16, surfaces: [] } }],
};

function setup(existing: PerformedProcedure[]) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  client.setQueryData(KEY, existing);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useCreateProcedure(PATIENT_ID), { wrapper });

  return { client, result };
}

const cached = (client: QueryClient): PerformedProcedure[] =>
  client.getQueryData<PerformedProcedure[]>(KEY) ?? [];

describe("useCreateProcedure", () => {
  it("adds the procedure to the cache before the server has answered", async () => {
    mockApi({ "POST /performed-procedures": { status: 201, body: makeProcedure(16) } });
    const existing = [makeProcedure(46)];
    const { client, result } = setup(existing);

    result.current.mutate(NEW_PROCEDURE);

    await waitFor(() => {
      expect(cached(client)).toHaveLength(2);
    });

    const added = cached(client)[1]!;
    expect(isOptimistic(added.id)).toBe(true);
    expect(added.procedureId).toBe(CATALOG.id);
    expect(added.chartMarks?.[0]?.location).toMatchObject({ tooth: 16 });
  });

  it("restores the previous cache when the write is refused", async () => {
    mockApi({ "POST /performed-procedures": { status: 400, body: { statusCode: 400 } } });
    const existing = [makeProcedure(46)];
    const { client, result } = setup(existing);

    result.current.mutate(NEW_PROCEDURE);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(cached(client)).toEqual(existing);
    expect(cached(client).some((procedure) => isOptimistic(procedure.id))).toBe(false);
  });

  it("leaves an empty cache empty after a refused write", async () => {
    mockApi({ "POST /performed-procedures": { status: 500, body: {} } });
    const { client, result } = setup([]);

    result.current.mutate(NEW_PROCEDURE);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(cached(client)).toEqual([]);
  });
});
