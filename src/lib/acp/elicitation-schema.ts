export type ElicitationValue = string | number | boolean | string[];

export type ElicitationOption = {
  value: string;
  label: string;
};

export type ElicitationField = {
  name: string;
  label: string;
  description: string | null;
  kind: "text" | "number" | "boolean" | "single_select" | "multi_select";
  options: ElicitationOption[];
  required: boolean;
  defaultValue?: ElicitationValue;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scalarString(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : null;
}

function parseOptions(value: unknown): ElicitationOption[] {
  const record = asRecord(value);
  if (!record) return [];

  const variants = Array.isArray(record.oneOf)
    ? record.oneOf
    : Array.isArray(record.anyOf)
      ? record.anyOf
      : [];
  const variantOptions = variants.flatMap((variant) => {
    const option = asRecord(variant);
    const optionValue = scalarString(option?.const);
    if (!option || optionValue === null) return [];
    return [{
      value: optionValue,
      label: nonEmptyString(option.title) ?? optionValue,
    }];
  });
  if (variantOptions.length > 0) return variantOptions;

  return Array.isArray(record.enum)
    ? record.enum.flatMap((item) => {
        const optionValue = scalarString(item);
        return optionValue === null ? [] : [{ value: optionValue, label: optionValue }];
      })
    : [];
}

function fieldKind(property: UnknownRecord, options: ElicitationOption[]): ElicitationField["kind"] {
  if (property.type === "array") return "multi_select";
  if (options.length > 0) return "single_select";
  if (property.type === "boolean") return "boolean";
  if (property.type === "number" || property.type === "integer") return "number";
  return "text";
}

export function parseElicitationFields(schema: unknown): ElicitationField[] {
  const schemaRecord = asRecord(schema);
  const properties = asRecord(schemaRecord?.properties) ?? {};
  const required = new Set(
    Array.isArray(schemaRecord?.required)
      ? schemaRecord.required.filter((item): item is string => typeof item === "string")
      : [],
  );

  return Object.entries(properties).flatMap(([name, rawProperty]) => {
    const property = asRecord(rawProperty);
    if (!property) return [];
    const options = property.type === "array"
      ? parseOptions(property.items)
      : parseOptions(property);
    return [{
      name,
      label: nonEmptyString(property.title) ?? (name.replace(/^question_/, "").replace(/[_-]+/g, " ").trim() || name),
      description: nonEmptyString(property.description),
      kind: fieldKind(property, options),
      options,
      required: required.has(name),
      ...(typeof property.default === "string" || typeof property.default === "number" || typeof property.default === "boolean" || (Array.isArray(property.default) && property.default.every((item) => typeof item === "string"))
        ? { defaultValue: property.default as ElicitationValue }
        : {}),
      ...(typeof property.minimum === "number" ? { minimum: property.minimum } : {}),
      ...(typeof property.maximum === "number" ? { maximum: property.maximum } : {}),
      ...(typeof property.minLength === "number" ? { minLength: property.minLength } : {}),
      ...(typeof property.maxLength === "number" ? { maxLength: property.maxLength } : {}),
      ...(typeof property.minItems === "number" ? { minItems: property.minItems } : {}),
      ...(typeof property.maxItems === "number" ? { maxItems: property.maxItems } : {}),
      ...(typeof property.pattern === "string" ? { pattern: property.pattern } : {}),
    }];
  });
}

export function buildElicitationContent(
  fields: readonly ElicitationField[],
  values: Readonly<Record<string, ElicitationValue | undefined>>,
): Record<string, ElicitationValue> {
  return Object.fromEntries(fields.flatMap((field) => {
    const value = values[field.name];
    if (value === undefined) return [];
    if (field.kind === "number" && typeof value === "string") {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? [[field.name, numberValue] as const] : [];
    }
    return [[field.name, value] as const];
  }));
}

export function hasMissingRequiredElicitationField(
  fields: readonly ElicitationField[],
  values: Readonly<Record<string, ElicitationValue | undefined>>,
) {
  return fields.some((field) => {
    if (!field.required) return false;
    const value = values[field.name];
    return Array.isArray(value) ? value.length === 0 : value === undefined || value === "";
  });
}

export function hasInvalidElicitationField(
  fields: readonly ElicitationField[],
  values: Readonly<Record<string, ElicitationValue | undefined>>,
) {
  return fields.some((field) => {
    const value = values[field.name];
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return false;
    if (Array.isArray(value)) {
      return (field.minItems !== undefined && value.length < field.minItems)
        || (field.maxItems !== undefined && value.length > field.maxItems);
    }
    if (field.kind === "number") {
      const numeric = typeof value === "number" ? value : Number(value);
      return !Number.isFinite(numeric)
        || (field.minimum !== undefined && numeric < field.minimum)
        || (field.maximum !== undefined && numeric > field.maximum);
    }
    if (typeof value === "string") {
      if (field.minLength !== undefined && value.length < field.minLength) return true;
      if (field.maxLength !== undefined && value.length > field.maxLength) return true;
      if (field.pattern) {
        try {
          return !new RegExp(field.pattern).test(value);
        } catch {
          return true;
        }
      }
    }
    return false;
  });
}
