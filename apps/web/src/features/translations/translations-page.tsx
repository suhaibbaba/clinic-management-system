import type { TranslationLanguage } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  SearchField,
  Select,
  Table,
  useToast,
  usePageParams,
  type Column,
} from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import ar from "@web/i18n/locales/ar.json";
import en from "@web/i18n/locales/en.json";
import { useSaveTranslations, useTranslationOverrides } from "@web/features/translations/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { useDebounced } from "@web/lib/use-debounced";

interface Row {
  readonly key: string;
  readonly section: string;
  readonly shipped: Record<TranslationLanguage, string>;
  readonly saved: Record<TranslationLanguage, string>;
}

const SHIPPED: Record<TranslationLanguage, Record<string, string>> = {
  ar: flatten(ar as Record<string, unknown>),
  en: flatten(en as Record<string, unknown>),
};

const KEYS = Object.keys(SHIPPED.ar);
const SECTIONS = [...new Set(KEYS.map((key) => key.split(".")[0] ?? ""))].sort();
const PER_PAGE = 25;

/** `ar:labs.orders.title` — one draft map for both languages. */
const draftId = (language: TranslationLanguage, key: string): string => `${language}:${key}`;

export function TranslationsPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setSearchParams] = useSearchParams();
  const { page, setPage, resetPage } = usePageParams(PER_PAGE, [PER_PAGE]);

  const section = params.get("section") ?? "";
  const changedOnly = params.get("changed") === "1";
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  const overrides = useTranslationOverrides();
  const save = useSaveTranslations();

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const setParams = (change: Record<string, string | undefined>): void => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(change)) {
          if (value === undefined) next.delete(key);
          else next.set(key, value);
        }
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  const saved = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of overrides.data ?? []) {
      map[draftId(row.language, row.key)] = row.value;
    }
    return map;
  }, [overrides.data]);

  const matched = useMemo<Row[]>(() => {
    const term = debounced.trim().toLowerCase();

    return KEYS.map((key) => ({
      key,
      section: key.split(".")[0] ?? "",
      shipped: { ar: SHIPPED.ar[key] ?? "", en: SHIPPED.en[key] ?? "" },
      saved: { ar: saved[draftId("ar", key)] ?? "", en: saved[draftId("en", key)] ?? "" },
    }))
      .filter((row) => (section === "" ? true : row.section === section))
      .filter((row) => (changedOnly ? row.saved.ar !== "" || row.saved.en !== "" : true))
      .filter((row) =>
        term === ""
          ? true
          : row.key.toLowerCase().includes(term) ||
            row.shipped.ar.toLowerCase().includes(term) ||
            row.shipped.en.toLowerCase().includes(term),
      );
  }, [section, changedOnly, debounced, saved]);

  const totalPages = Math.max(1, Math.ceil(matched.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const rows = matched.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  // A draft only counts once it differs from what is stored, so re-typing the same word leaves the
  // footer closed.
  const pending = useMemo(
    () => Object.entries(drafts).filter(([id, value]) => value !== (saved[id] ?? "")),
    [drafts, saved],
  );

  const valueOf = (row: Row, language: TranslationLanguage): string =>
    drafts[draftId(language, row.key)] ?? row.saved[language];

  const write = (language: TranslationLanguage, key: string, value: string): void =>
    setDrafts((previous) => ({ ...previous, [draftId(language, key)]: value }));

  const languageCell = (row: Row, language: TranslationLanguage): JSX.Element => (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-meta text-ink-subtle" dir={language === "ar" ? "rtl" : "ltr"}>
        {row.shipped[language]}
      </span>
      <Input
        data-testid={`translations-${language}-${row.key}`}
        className="min-w-0"
        dir={language === "ar" ? "rtl" : "ltr"}
        value={valueOf(row, language)}
        placeholder={row.shipped[language]}
        onChange={(event) => write(language, row.key, event.target.value)}
      />
    </span>
  );

  const columns: readonly Column<Row>[] = [
    {
      key: "original",
      header: "translations.original",
      primary: true,
      className: "w-[22%] align-top",
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-value text-ink">{row.shipped.ar}</span>
          <span className="truncate text-meta text-ink-subtle" dir="ltr">
            {row.key}
          </span>
        </span>
      ),
    },
    {
      key: "ar",
      header: "translations.arabic",
      className: "w-[39%] align-top",
      render: (row) => languageCell(row, "ar"),
    },
    {
      key: "en",
      header: "translations.english",
      className: "w-[39%] align-top",
      render: (row) => languageCell(row, "en"),
    },
  ];

  const submit = async (): Promise<void> => {
    try {
      await save.mutateAsync({
        items: pending.map(([id, value]) => {
          const [language, ...rest] = id.split(":");
          return {
            language: language as TranslationLanguage,
            key: rest.join(":"),
            value,
          };
        }),
      });
      setDrafts({});
      toast.success("translations.saved");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div data-testid="translations-page" className="flex flex-col gap-5 pb-24">
      <PageHeader
        data-testid="translations-header"
        title="translations.title"
        subtitle="translations.subtitle"
        count={matched.length}
      />

      <p className="text-label text-ink-muted">{t("translations.hint")}</p>

      <div className="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SearchField
          data-testid="translations-search"
          className="w-full min-w-0 md:col-span-2"
          label={t("translations.search")}
          shortcut="/"
          placeholder={t("translations.searchPlaceholder")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
          clearLabel={t("common.clear")}
          onClear={() => setSearch("")}
        />

        <div className="min-w-0">
          <label htmlFor="translations-section" className="mb-1 block text-label text-ink-muted">
            {t("translations.section")}
          </label>
          <Select
            id="translations-section"
            data-testid="translations-section"
            value={section}
            placeholder={t("translations.allSections")}
            onChange={(event) => setParams({ section: event.target.value || undefined })}
            options={SECTIONS.map((value) => ({ value, label: value }))}
          />
        </div>

        <div className="flex min-w-0 items-end">
          <Chip
            selected={changedOnly}
            data-testid="translations-changed-only"
            onClick={() => setParams({ changed: changedOnly ? undefined : "1" })}
          >
            <Icon name="edit" className="size-3.5 shrink-0" />
            {t("translations.changedOnly", { count: Object.keys(saved).length })}
          </Chip>
        </div>
      </div>

      <Table
        data-testid="translations-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        isLoading={overrides.isPending}
        pagination={{
          page: current,
          totalPages,
          total: matched.length,
          onPageChange: setPage,
          "data-testid": "translations-pagination",
        }}
        empty={
          <EmptyState
            icon="language"
            data-testid="translations-empty"
            title="translations.empty"
            hint="translations.emptyHint"
          />
        }
      />

      {pending.length > 0 && (
        <div
          data-testid="translations-footer"
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t border-line",
            // Glass: the rows keep scrolling under it, so what is being saved stays in view.
            "bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70",
          )}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <span className="text-value text-ink">
              {t("translations.pending", { count: pending.length })}
            </span>

            <span className="ms-auto flex items-center gap-2">
              <Button
                variant="secondary"
                data-testid="translations-cancel"
                disabled={save.isPending}
                onClick={() => setDrafts({})}
              >
                {t("common.cancel")}
              </Button>
              <Button
                icon={<Icon name="check" />}
                data-testid="translations-save"
                isLoading={save.isPending}
                onClick={() => void submit()}
              >
                {t("translations.save")}
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** `{ a: { b: "x" } }` → `{ "a.b": "x" }`, which is how a key is stored and searched. */
function flatten(source: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;

    if (typeof value === "string") {
      out[path] = value;
    } else if (value !== null && typeof value === "object") {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    }
  }

  return out;
}
