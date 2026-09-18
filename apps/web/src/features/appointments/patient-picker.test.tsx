import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import { describe, expect, it } from "vitest";
import { PatientPicker, type PatientChoice } from "@web/features/appointments/patient-picker";
import ar from "@web/i18n/locales/ar.json";
import { paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const patient = (index: number) => ({
  id: `patient-${index}`,
  clinicId: "clinic",
  fullName: `محمد ${index}`,
  phone: `+96277000000${index}`,
  fileNumber: `P-00${index}`,
  profileIncomplete: false,
});

function Harness({ allowNew }: { readonly allowNew?: boolean }): JSX.Element {
  const [value, setValue] = useState<PatientChoice | null>(null);

  return (
    <PatientPicker
      id="patient"
      value={value}
      onChange={setValue}
      {...(allowNew === undefined ? {} : { allowNew })}
    />
  );
}

const CREATE = new RegExp(ar.patients.createNamed.replace("{{name}}", ""));

const field = (): HTMLElement => screen.getByRole("combobox", { name: ar.patients.search });
const newPatientOption = (): HTMLElement => screen.getByRole("option", { name: CREATE });

async function search(term: string, matches: number, allowNew?: boolean): Promise<void> {
  mockApi({
    "GET /patients": {
      body: paginated(Array.from({ length: matches }, (_, index) => patient(index + 1))),
    },
  });

  renderWithProviders(<Harness {...(allowNew === undefined ? {} : { allowNew })} />);
  await userEvent.type(field(), term);
  await screen.findByRole("listbox");
}

describe("PatientPicker", () => {
  it("floats the results over the form rather than pushing it down", async () => {
    await search("محمد", 3);

    // Portalled out of the field's own subtree: an inline list would be a descendant of it.
    expect(field().closest("div")).not.toContainElement(screen.getByRole("listbox"));
  });

  it("offers a new patient even when existing names match the term", async () => {
    await search("محمد", 3);

    await screen.findByText("محمد 1");

    expect(newPatientOption()).toBeInTheDocument();
  });

  it("keeps the new-patient option out of the scrolling area", async () => {
    await search("محمد", 3);

    await screen.findByText("محمد 1");

    const scroller = screen.getByText("محمد 1").closest("[class*=overflow-y-auto]");

    expect(within(scroller as HTMLElement).getAllByRole("option")).toHaveLength(3);
    expect(scroller).not.toContainElement(newPatientOption());
  });

  it("walks the options with the arrow keys and takes one with Enter", async () => {
    await search("محمد", 3);

    await screen.findByText("محمد 1");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    expect(screen.getByRole("option", { name: /محمد 3/ })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");

    expect(screen.getByText("محمد 3")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reaches the new-patient option by keyboard, last in the order", async () => {
    await search("محمد", 3);

    await screen.findByText("محمد 1");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    expect(newPatientOption()).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");

    expect(screen.getByLabelText(new RegExp(ar.patients.fullName))).toHaveValue("محمد");
  });

  it("carries the typed name into the registration form", async () => {
    await search("محمد", 3);

    await screen.findByText("محمد 1");
    await userEvent.click(newPatientOption());

    expect(screen.getByLabelText(new RegExp(ar.patients.fullName))).toHaveValue("محمد");
  });

  it("never shows the previous term's patients under the new one", async () => {
    // The query keeps the last page while the next is in flight; a slow second request is what
    // made the panel show one clinic's Ahmads and then swap them for another's.
    mockApi({
      "GET /patients": ({ url }) => ({
        body: paginated(
          url.includes("%D8%B3") || url.includes("\u0633") ? [patient(9)] : [patient(1)],
        ),
      }),
    });

    renderWithProviders(<Harness />);

    await userEvent.type(field(), "م");
    await screen.findByText("محمد 1");

    await userEvent.type(field(), "س");

    // The moment the term changes, the settled list is gone rather than lingering as an answer.
    expect(screen.queryByText("محمد 1")).toBeNull();

    await screen.findByText("محمد 9");
  });

  it("stays open when the field it hangs off is clicked", async () => {
    await search("محمد", 3);

    await screen.findByText("محمد 1");
    await userEvent.click(field());

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("محمد 1")).toBeInTheDocument();
  });

  it("asks the server nothing until something is typed", async () => {
    const { calls } = mockApi({ "GET /patients": { body: paginated([]) } });

    renderWithProviders(<Harness />);

    expect(calls.filter((call) => call.url.includes("/patients"))).toEqual([]);
  });

  it("keeps Enter working when a refetch empties the list under a held position", async () => {
    // A background refetch blanks the results while `active` sits past the end of what is left.
    // The second request never settles, so the panel stays in that state to be tested.
    let served = 0;
    mockApi({
      "GET /patients": () => {
        served += 1;

        return served === 1
          ? { body: paginated(Array.from({ length: 8 }, (_, index) => patient(index + 1))) }
          : new Promise<never>(() => {});
      },
    });

    renderWithProviders(<Harness />);
    await userEvent.type(field(), "محمد");
    await screen.findByText("محمد 1");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: /محمد 6/ })).toHaveAttribute("aria-selected", "true");

    await act(async () => {
      window.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(screen.queryByText("محمد 6")).toBeNull());

    // Only the create row is left; a held index past the end must land on it, not on nothing.
    await userEvent.keyboard("{Enter}");

    expect(screen.getByLabelText(new RegExp(ar.patients.fullName))).toHaveValue("محمد");
  });

  it("offers nothing to register where registering is beside the point", async () => {
    await search("محمد", 1, false);

    await screen.findByText("محمد 1");

    expect(screen.queryByRole("option", { name: CREATE })).toBeNull();
  });
});
