import { TRANSLATION_LANGUAGES, type TranslationLanguage } from "@clinic/shared";
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
  type Column,
} from "@clinic/ui";
import ar from "@web/i18n/locales/ar.json";
import en from "@web/i18n/locales/en.json";
import { errorMessageKey } from "@web/lib/api-error";
import {
  useResetTranslation,
  useSaveTranslation,
  useTranslationOverrides,
} from "@web/features/translations/queries";
import { useDebounced } from "@web/lib/use-debounced";

interface Row {
  readonly key: string;
  readonly section: string;
  readonly shipped: string;
  readonly override: string | undefined;
}

const SHIPPED: Record<TranslationLanguage, Record<string, string>> = {
  ar: flatten(ar as Record<string, unknown>),
  en: flatten(en as Record<string, unknown>),
};

const SECTIONS = [...new Set(Object.keys(SHIPPED.ar).map((key) => key.split(".")[0] ?? ""))].sort();

export function TranslationsPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setSearchParams] = useSearchParams();

  // Filters live in the address, so a reworded key is a link somebody can send.
  const setParams = (change: Record<string, string | undefined>): void => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(change)) {
          if (value === undefined) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  const language = (params.get("lang") === "en" ? "en" : "ar") as TranslationLanguage;
  const section = params.get("section") ?? "";
  const changedOnly = params.get("changed") === "1";
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  const overrides = useTranslationOverrides();
  const save = useSaveTranslation();
  const reset = useResetTranslation();

  const overrideMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of overrides.data ?? []) {
      if (row.language === language) {
        map.set(row.key, row.value);
      }
    }
    return map;
  }, [overrides.data, language]);

  const rows = useMemo<Row[]>(() => {
    const term = debounced.trim().toLowerCase();

    return Object.entries(SHIPPED[language])
      .map(([key, shipped]) => ({
        key,
        section: key.split(".")[0] ?? "",
        shipped,
        override: overrideMap.get(key),
      }))
      .filter((row) => (section === "" ? true : row.section === section))
      .filter((row) => (changedOnly ? row.override !== undefined : true))
      .filter((row) =>
        term === ""
          ? true
          : row.key.toLowerCase().includes(term) ||
            row.shipped.toLowerCase().includes(term) ||
            (row.override ?? "").toLowerCase().includes(term),
      );
  }, [language, section, changedOnly, debounced, overrideMap]);

  const columns: readonly Column<Row>[] = [
    {
      key: "text",
      header: "translations.default",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-ink">{row.shipped}</span>
          <span className="text-meta text-ink-subtle" dir="ltr">
            {row.key}
          </span>
        </span>
      ),
    },
    {
      key: "value",
      header: "translations.value",
      render: (row) => <RowEditor row={row} language={language} />,
    },
  ];

  return (
    <div data-testid="translations-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="translations-header"
        title="translations.title"
        subtitle="translations.subtitle"
        count={rows.length}
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
          onChange={(event) => setSearch(event.target.value)}
          clearLabel={t("common.clear")}
          onClear={() => setSearch("")}
        />

        <div className="min-w-0">
          <label htmlFor="translations-language" className="mb-1 block text-label text-ink-muted">
            {t("translations.language")}
          </label>
          <Select
            id="translations-language"
            data-testid="translations-language"
            value={language}
            onChange={(event) => setParams({ lang: event.target.value })}
            options={TRANSLATION_LANGUAGES.map((value) => ({
              value,
              label: t(`common.languages.${value}`, { defaultValue: value }),
            }))}
          />
        </div>

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
            {t("translations.changedOnly", { count: overrideMap.size })}
          </Chip>
        </div>
      </div>

      <Table
        data-testid="translations-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        isLoading={overrides.isPending}
        empty={
          <EmptyState
            icon="language"
            data-testid="translations-empty"
            title="translations.empty"
            hint="translations.emptyHint"
          />
        }
      />
    </div>
  );

  function RowEditor({ row, language: lang }: { row: Row; language: TranslationLanguage }) {
    return (
      <Editor
        row={row}
        language={lang}
        onSave={async (value) => {
          try {
            await save.mutateAsync({ language: lang, key: row.key, value });
            toast.success("translations.saved");
          } catch (error) {
            toast.error(errorMessageKey(error));
          }
        }}
        onReset={async () => {
          try {
            await reset.mutateAsync({ language: lang, key: row.key });
            toast.success("translations.wasReset");
          } catch (error) {
            toast.error(errorMessageKey(error));
          }
        }}
      />
    );
  }
}

function Editor({
  row,
  language,
  onSave,
  onReset,
}: {
  readonly row: Row;
  readonly language: TranslationLanguage;
  readonly onSave: (value: string) => Promise<void>;
  readonly onReset: () => Promise<void>;
}): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(row.override ?? "");
  const current = row.override ?? "";
  const dirty = draft.trim() !== current && draft.trim() !== "";

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Input
        data-testid={`translations-input-${row.key}`}
        className="min-w-0 flex-1"
        dir={language === "ar" ? "rtl" : "ltr"}
        value={draft}
        placeholder={row.shipped}
        onChange={(event) => setDraft(event.target.value)}
      />

      {dirty && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="check" />}
          data-testid={`translations-save-${row.key}`}
          onClick={() => void onSave(draft.trim())}
        >
          {t("translations.save")}
        </Button>
      )}

      {row.override !== undefined && !dirty && (
        <Button
          size="sm"
          variant="quiet"
          icon={<Icon name="reset" />}
          data-testid={`translations-reset-${row.key}`}
          onClick={() => {
            setDraft("");
            void onReset();
          }}
        >
          {t("translations.reset")}
        </Button>
      )}
    </span>
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
