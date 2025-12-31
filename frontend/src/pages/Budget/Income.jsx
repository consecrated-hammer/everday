import { useEffect, useMemo, useState } from "react";

import { CreateIncomeStream, DeleteIncomeStream, FetchIncomeStreams, UpdateIncomeStream } from "../../lib/budgetApi.js";
import DataTable from "../../components/DataTable.jsx";
import Icon from "../../components/Icon.jsx";
import { ToNumber } from "../../lib/formatters.js";

const emptyForm = {
  Label: "",
  NetAmount: "",
  GrossAmount: "",
  FirstPayDate: "",
  Frequency: "Monthly",
  EndDate: "",
  Notes: ""
};

const HOURS_PER_WEEK = 38;

const BudgetIncome = () => {
  const [streams, setStreams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => (
    form.Label.trim() &&
    form.NetAmount &&
    form.GrossAmount &&
    form.FirstPayDate &&
    form.Frequency
  ), [form]);

  const loadStreams = async () => {
    try {
      setStatus("loading");
      setError("");
      const data = await FetchIncomeStreams();
      const normalized = data.map((stream) => ({
        ...stream,
        NetPerHour:
          stream.NetPerWeek === null || stream.NetPerWeek === undefined
            ? null
            : ToNumber(stream.NetPerWeek) / HOURS_PER_WEEK,
        GrossPerHour:
          stream.GrossPerWeek === null || stream.GrossPerWeek === undefined
            ? null
            : ToNumber(stream.GrossPerWeek) / HOURS_PER_WEEK
      }));
      setStreams(normalized);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to load income streams");
    }
  };

  useEffect(() => {
    loadStreams();
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    try {
      setStatus("saving");
      setError("");
      const payload = {
        ...form,
        NetAmount: Number(form.NetAmount),
        GrossAmount: Number(form.GrossAmount),
        EndDate: form.EndDate || null,
        Notes: form.Notes || null
      };
      if (editingId) {
        await UpdateIncomeStream(editingId, payload);
      } else {
        await CreateIncomeStream(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      setModalOpen(false);
      await loadStreams();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to save income stream");
    }
  };

  const onEdit = (stream) => {
    setForm({
      Label: stream.Label,
      NetAmount: String(stream.NetAmount),
      GrossAmount: String(stream.GrossAmount),
      FirstPayDate: stream.FirstPayDate,
      Frequency: stream.Frequency,
      EndDate: stream.EndDate || "",
      Notes: stream.Notes || ""
    });
    setEditingId(stream.Id);
    setModalOpen(true);
  };

  const onCancelEdit = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(false);
  };

  const onDelete = async (stream) => {
    if (!window.confirm(`Delete income stream "${stream.Label}"?`)) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteIncomeStream(stream.Id);
      await loadStreams();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete income stream");
    }
  };

  const onDeleteFromModal = async () => {
    if (!editingId) {
      return;
    }
    const stream = streams.find((item) => item.Id === editingId);
    if (!stream) {
      return;
    }
    if (!window.confirm(`Delete income stream "${stream.Label}"?`)) {
      return;
    }
    try {
      setStatus("saving");
      setError("");
      await DeleteIncomeStream(editingId);
      await loadStreams();
      onCancelEdit();
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Failed to delete income stream");
    }
  };

  const netColumns = [
    { key: "Label", label: "Name", sortable: true, width: 220 },
    { key: "NetAmount", label: "Net", sortable: true, width: 140, isCurrency: true },
    { key: "Frequency", label: "Frequency", sortable: true, filterable: true, width: 160 },
    { key: "NetPerHour", label: "Per hour", sortable: true, width: 140, isCurrency: true },
    { key: "NetPerFortnight", label: "Per fortnight", sortable: true, width: 160, isCurrency: true },
    { key: "NetPerMonth", label: "Per month", sortable: true, width: 160, isCurrency: true },
    { key: "NetPerYear", label: "Per year", sortable: true, width: 150, isCurrency: true },
    { key: "FirstPayDate", label: "First pay", sortable: true, width: 160 },
    { key: "EndDate", label: "End", sortable: true, width: 140, render: (row) => row.EndDate || "-" }
  ];

  const grossColumns = [
    { key: "Label", label: "Name", sortable: true, width: 220 },
    { key: "GrossAmount", label: "Gross", sortable: true, width: 140, isCurrency: true },
    { key: "Frequency", label: "Frequency", sortable: true, filterable: true, width: 160 },
    { key: "GrossPerHour", label: "Per hour", sortable: true, width: 140, isCurrency: true },
    { key: "GrossPerFortnight", label: "Per fortnight", sortable: true, width: 160, isCurrency: true },
    { key: "GrossPerMonth", label: "Per month", sortable: true, width: 160, isCurrency: true },
    { key: "GrossPerYear", label: "Per year", sortable: true, width: 150, isCurrency: true },
    { key: "FirstPayDate", label: "First pay", sortable: true, width: 160 },
    { key: "EndDate", label: "End", sortable: true, width: 140, render: (row) => row.EndDate || "-" }
  ];

  return (
    <div className="module-panel">
      <header className="module-panel-header">
        <div>
          <h2>Income streams</h2>
          <p>Track shared income sources and schedules.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setModalOpen(true)}>
          Add income stream
        </button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="income-table-section">
        <div className="income-table-header">
          <h3>Net income</h3>
          <p>What hits your account after deductions.</p>
        </div>
        <DataTable
          tableKey="budget-income-net"
          columns={netColumns}
          rows={streams}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      <div className="income-table-section">
        <div className="income-table-header">
          <h3>Gross income</h3>
          <p>Total salary before deductions.</p>
        </div>
        <DataTable
          tableKey="budget-income-gross"
          columns={grossColumns}
          rows={streams}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingId ? "Edit income stream" : "Add income stream"}</h3>
              <div className="modal-header-actions">
                <button type="button" className="icon-button" onClick={onCancelEdit} aria-label="Close">
                  <Icon name="close" className="icon action-icon" />
                  <span className="action-label">Close</span>
                </button>
              </div>
            </div>
            <form className="form-grid" onSubmit={onSubmit}>
              <label>
                <span>Label</span>
                <input name="Label" value={form.Label} onChange={onChange} required />
              </label>
              <label>
                <span>Net amount</span>
                <input name="NetAmount" type="number" step="0.01" value={form.NetAmount} onChange={onChange} required />
              </label>
              <label>
                <span>Gross amount</span>
                <input
                  name="GrossAmount"
                  type="number"
                  step="0.01"
                  value={form.GrossAmount}
                  onChange={onChange}
                  required
                />
              </label>
              <label>
                <span>First pay date</span>
                <input name="FirstPayDate" type="date" value={form.FirstPayDate} onChange={onChange} required />
              </label>
              <label>
                <span>Frequency</span>
                <select name="Frequency" value={form.Frequency} onChange={onChange}>
                  <option value="Weekly">Weekly</option>
                  <option value="Fortnightly">Fortnightly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                </select>
              </label>
              <label>
                <span>End date</span>
                <input name="EndDate" type="date" value={form.EndDate} onChange={onChange} />
              </label>
              <label className="form-span">
                <span>Notes</span>
                <textarea name="Notes" value={form.Notes} onChange={onChange} rows="3" />
              </label>
              <div className="form-actions form-actions--icons">
                <button
                  type="submit"
                  className="icon-button is-primary"
                  disabled={!canSubmit || status === "saving"}
                  aria-label={editingId ? "Save income stream" : "Add income stream"}
                >
                  <Icon name="save" className="icon action-icon" />
                  <span className="action-label">{editingId ? "Save" : "Add"}</span>
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className="icon-button is-danger"
                    onClick={onDeleteFromModal}
                    disabled={status === "saving"}
                    aria-label="Delete income stream"
                  >
                    <Icon name="trash" className="icon action-icon" />
                    <span className="action-label">Delete</span>
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BudgetIncome;
