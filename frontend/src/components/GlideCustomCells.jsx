/* eslint-disable react-refresh/only-export-components */
import React from "react";

import { GridCellKind, textCellRenderer } from "@glideapps/glide-data-grid";

const BuildDisplayText = (value) => (value === null || value === undefined ? "" : String(value));

const BuildSelectValue = (value, multiple) => {
  if (multiple) {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry));
    }
    if (value === null || value === undefined || value === "") {
      return [];
    }
    return [String(value)];
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

export const BuildDateCell = (value, displayValue, themeOverride) => {
  const display = BuildDisplayText(displayValue ?? value);
  return {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    readonly: false,
    copyData: display,
    themeOverride,
    data: {
      editor: "date",
      value: value ?? "",
      display
    }
  };
};

export const BuildDateRangeCell = ({ start, end, display, themeOverride }) => {
  const normalizedStart = start ?? "";
  const normalizedEnd = end ?? "";
  const displayValue = BuildDisplayText(display || "");
  return {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    readonly: false,
    copyData: displayValue,
    themeOverride,
    data: {
      editor: "date-range",
      value: {
        start: normalizedStart,
        end: normalizedEnd
      },
      display: displayValue
    }
  };
};

export const BuildSelectCell = ({ value, display, options, multiple, themeOverride }) => {
  const normalizedOptions = Array.isArray(options) ? options : [];
  const displayValue = BuildDisplayText(display ?? "");
  return {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    readonly: false,
    activationBehaviorOverride: multiple ? "single-click" : undefined,
    copyData: displayValue,
    themeOverride,
    data: {
      editor: "select",
      value: BuildSelectValue(value, multiple),
      display: displayValue,
      options: normalizedOptions,
      multiple: Boolean(multiple)
    }
  };
};

const CustomEditorShell = ({ children }) => (
  <div className="glide-custom-editor" role="presentation">
    {children}
  </div>
);

const DateEditor = ({ value, onChange, onFinishedEditing }) => {
  const current = value?.data?.value || "";
  return (
    <CustomEditorShell>
      <input
        type="date"
        className="form-input glide-custom-input"
        value={current}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange({
            ...value,
            copyData: nextValue,
            data: {
              ...value.data,
              value: nextValue,
              display: nextValue
            }
          });
        }}
        onBlur={() => onFinishedEditing(value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onFinishedEditing(value, [0, 1]);
          }
        }}
      />
    </CustomEditorShell>
  );
};

const DateRangeEditor = ({ value, onChange, onFinishedEditing }) => {
  const current = value?.data?.value || {};
  const start = current.start || "";
  const end = current.end || "";
  const updateValue = (next) => {
    const display = [next.start, next.end].filter(Boolean).join(" to ");
    onChange({
      ...value,
      copyData: display,
      data: {
        ...value.data,
        value: next,
        display
      }
    });
  };
  return (
    <CustomEditorShell>
      <div className="glide-custom-range">
        <input
          type="date"
          className="form-input glide-custom-input"
          value={start}
          onChange={(event) => updateValue({ start: event.target.value, end })}
          onBlur={() => onFinishedEditing(value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onFinishedEditing(value, [0, 1]);
            }
          }}
        />
        <input
          type="date"
          className="form-input glide-custom-input"
          value={end}
          onChange={(event) => updateValue({ start, end: event.target.value })}
          onBlur={() => onFinishedEditing(value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onFinishedEditing(value, [0, 1]);
            }
          }}
        />
      </div>
    </CustomEditorShell>
  );
};

const SelectEditor = ({ value, onChange, onFinishedEditing }) => {
  const options = value?.data?.options || [];
  const multiple = Boolean(value?.data?.multiple);
  const currentValue = value?.data?.value ?? (multiple ? [] : "");
  const handleChange = (event) => {
    if (multiple) {
      const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
      onChange({
        ...value,
        data: {
          ...value.data,
          value: selected,
          display: selected
            .map((val) => options.find((opt) => String(opt.value) === String(val))?.label || val)
            .filter(Boolean)
            .join(", ")
        }
      });
    } else {
      const nextValue = event.target.value;
      const match = options.find((opt) => String(opt.value) === String(nextValue));
      onChange({
        ...value,
        data: {
          ...value.data,
          value: nextValue,
          display: match?.label || nextValue
        }
      });
    }
  };
  return (
    <CustomEditorShell>
      <select
        className="form-input glide-custom-input"
        value={currentValue}
        multiple={multiple}
        onChange={handleChange}
        onBlur={() => onFinishedEditing(value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onFinishedEditing(value, [0, 1]);
          }
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </CustomEditorShell>
  );
};

export const GlideCustomRenderer = {
  kind: GridCellKind.Custom,
  isMatch: (cell) =>
    cell?.data?.editor === "date" ||
    cell?.data?.editor === "date-range" ||
    cell?.data?.editor === "select",
  drawPrep: textCellRenderer.drawPrep,
  draw: (args) => {
    const display = BuildDisplayText(args.cell?.data?.display ?? args.cell?.copyData ?? "");
    const textCell = {
      ...args.cell,
      kind: GridCellKind.Text,
      data: display,
      displayData: display,
      allowOverlay: false
    };
    textCellRenderer.draw({ ...args, cell: textCell });
  },
  measure: (ctx, cell, theme) => {
    const display = BuildDisplayText(cell?.data?.display ?? cell?.copyData ?? "");
    const textCell = {
      ...cell,
      kind: GridCellKind.Text,
      data: display,
      displayData: display,
      allowOverlay: false
    };
    return textCellRenderer.measure?.(ctx, textCell, theme) ?? 0;
  },
  provideEditor: (cell) => {
    if (cell.data?.editor === "date") {
      return {
        editor: DateEditor,
        disablePadding: true
      };
    }
    if (cell.data?.editor === "date-range") {
      return {
        editor: DateRangeEditor,
        disablePadding: true
      };
    }
    if (cell.data?.editor === "select") {
      return {
        editor: SelectEditor,
        disablePadding: true
      };
    }
    return undefined;
  }
};
