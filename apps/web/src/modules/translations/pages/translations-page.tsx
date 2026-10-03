import type { TranslationLanguage } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_PER_PAGE,
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
import ar from "@web/i18n/locales/ar.json";
import en from "@web/i18n/locales/en.json";
import { useSaveTranslations, useTranslationOverrides } from "@web/modules/translations/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { useDebounced } from "@web/shared/hooks/use-debounced";

interface Group {
  readonly id: string;
  readonly keys: readonly string[];
  readonly sections: ReadonlySet<string>;
  readonly shipped: Record<TranslationLanguage, string>;
}

type Row =
  | { readonly kind: "group"; readonly group: Group }
  | { readonly kind: "key"; readonly key: string; readonly group: Group };

const SHIPPED: Record<TranslationLanguage, Record<string, string>> = {
  ar: flatten(ar as Record<string, unknown>),
  en: flatten(en as Record<string, unknown>),
};

const KEYS = Object.keys(SHIPPED.ar);
const sectionOf = (key: string): string => key.split(".")[0] ?? "";
import { UnsavedChanges } from "@web/shared/components/unsaved-changes";
const SECTIONS = [...new Set(KEYS.map(sectionOf))].sort();

const GROUPS: readonly Group[] = (() => {
  const byText = new Map<string, string[]>();

  for (const key of KEYS) {
    const text = `${SHIPPED.ar[key] ?? ""}\u0000${SHIPPED.en[key] ?? ""}`;
    byText.set(text, [...(byText.get(text) ?? []), key]);
  }

  return [...byText.values()].map((keys) => ({
    id: keys[0] ?? "",
    keys,
    sections: new Set(keys.map(sectionOf)),
    shipped: { ar: SHIPPED.ar[keys[0] ?? ""] ?? "", en: SHIPPED.en[keys[0] ?? ""] ?? "" },
  }));
})();

const draftId = (language: TranslationLanguage, key: string): string => `${language}:${key}`;

export function TranslationsPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setSearchParams] = useSearchParams();
  const { page, perPage, setPage, resetPage } = usePageParams([DEFAULT_PER_PAGE]);

  const section = params.get("section") ?? "";
  const changedOnly = params.get("changed") === "1";
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  const overrides = useTranslationOverrides();
  const save = useSaveTranslations();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

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

  const matched = useMemo<Group[]>(() => {
    const term = debounced.trim().toLowerCase();

    return GROUPS.filter((group) => (section === "" ? true : group.sections.has(section)))
      .filter((group) =>
        changedOnly
          ? group.keys.some((key) => saved[draftId("ar", key)] || saved[draftId("en", key)])
          : true,
      )
      .filter((group) =>
        term === ""
          ? true
          : group.shipped.ar.toLowerCase().includes(term) ||
            group.shipped.en.toLowerCase().includes(term) ||
            group.keys.some((key) => key.toLowerCase().includes(term)),
      );
  }, [section, changedOnly, debounced, saved]);

  const totalPages = Math.max(1, Math.ceil(matched.length / perPage));
  const current = Math.min(page, totalPages);
  const rows: Row[] = matched
    .slice((current - 1) * perPage, current * perPage)
    .flatMap((group) => [
      { kind: "group" as const, group },
      ...(open.has(group.id)
        ? group.keys.map((key) => ({ kind: "key" as const, key, group }))
        : []),
    ]);

  const pending = useMemo(
    () => Object.entries(drafts).filter(([id, value]) => value !== (saved[id] ?? "")),
    [drafts, saved],
  );

  const keyValue = (language: TranslationLanguage, key: string): string =>
    drafts[draftId(language, key)] ?? saved[draftId(language, key)] ?? "";

  const groupValue = (group: Group, language: TranslationLanguage): string | null => {
    const values = new Set(group.keys.map((key) => keyValue(language, key)));
    return values.size === 1 ? ([...values][0] ?? "") : null;
  };

  const write = (language: TranslationLanguage, keys: readonly string[], value: string): void =>
    setDrafts((previous) => ({
      ...previous,
      ...Object.fromEntries(keys.map((key) => [draftId(language, key), value])),
    }));

  const toggle = (id: string): void =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const languageCell = (row: Row, language: TranslationLanguage): JSX.Element => {
    const keys = row.kind === "group" ? row.group.keys : [row.key];
    const value =
      row.kind === "group" ? groupValue(row.group, language) : keyValue(language, row.key);
    const testKey = row.kind === "group" ? row.group.id : `${row.key}-only`;

    return (
      <span className="flex min-w-0 flex-col gap-1">
        {row.kind === "group" && (
          <span
            className="truncate text-meta text-ink-subtle"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {row.group.shipped[language]}
          </span>
        )}
        <Input
          data-testid={`translations-${language}-${testKey}`}
          className="min-w-0"
          dir={language === "ar" ? "rtl" : "ltr"}
          value={value ?? ""}
          placeholder={value === null ? t("translations.mixed") : row.group.shipped[language]}
          onChange={(event) => write(language, keys, event.target.value)}
        />
      </span>
    );
  };

  const columns: readonly Column<Row>[] = [
    {
      key: "original",
      header: "translations.original",
      primary: true,
      className: "w-[22%] align-top",
      render: (row) =>
        row.kind === "key" ? (
          <span className="block truncate ps-4 text-meta text-ink-subtle" dir="ltr">
            {row.key}
          </span>
        ) : (
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="max-w-full truncate text-value text-ink">{row.group.shipped.ar}</span>
            {row.group.keys.length === 1 ? (
              <span className="max-w-full truncate text-meta text-ink-subtle" dir="ltr">
                {row.group.id}
              </span>
            ) : (
              <Button
                size="sm"
                variant="quiet"
                data-testid={`translations-places-${row.group.id}`}
                aria-expanded={open.has(row.group.id)}
                icon={<Icon name={open.has(row.group.id) ? "chevron-up" : "chevron-down"} />}
                onClick={() => toggle(row.group.id)}
              >
                {t("translations.usedIn", { count: row.group.keys.length })}
              </Button>
            )}
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
      toast.error(...errorToast(error));
    }
  };

  return (
    <div data-testid="translations-page" className="flex flex-col gap-5">
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
        rowKey={(row) => (row.kind === "group" ? `group:${row.group.id}` : `key:${row.key}`)}
        isLoading={overrides.isPending}
        pagination={{
          page: current,
          totalPages,
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

      <UnsavedChanges
        data-testid="translations-unsaved"
        dirty={pending.length > 0}
        saving={save.isPending}
        count={pending.length}
        watchParams={["view"]}
        onSave={() => void submit()}
        onDiscard={() => setDrafts({})}
      />
    </div>
  );
}

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
