import { useEffect, useMemo, useState } from "react";

import {
  CreateLifeCategory,
  CreateLifeDropdown,
  CreateLifeDropdownOption,
  CreateLifeField,
  CreateLifePerson,
  DeleteLifeCategory,
  DeleteLifeField,
  UpdateLifeCategory,
  UpdateLifeDropdown,
  UpdateLifeDropdownOption,
  UpdateLifeField,
  UpdateLifePerson
} from "../../lib/lifeAdminApi.js";
import { useLifeAdminCatalog } from "../../hooks/useLifeAdminCatalog.js";
import { useLifeAdminDropdownOptions } from "../../hooks/useLifeAdminDropdownOptions.js";
import { useLifeAdminFields } from "../../hooks/useLifeAdminFields.js";
import { useLifeAdminUsers } from "../../hooks/useLifeAdminUsers.js";

const FieldTypes = [
  "Text",
  "LongText",
  "Number",
  "Currency",
  "Date",
  "DateRange",
  "Dropdown",
  "Person",
  "RecordLink",
  "Boolean"
];

const EmptyCategoryForm = {
  Name: "",
  Description: "",
  SortOrder: 0,
  IsActive: true
};

const EmptyFieldForm = {
  Name: "",
  Key: "",
  FieldType: "Text",
  IsRequired: false,
  IsMulti: false,
  SortOrder: 0,
  DropdownId: "",
  LinkedCategoryId: "",
  Config: {}
};

const EmptyDropdownForm = {
  Name: "",
  Description: ""
};

const EmptyOptionForm = {
  Label: "",
  Value: "",
  SortOrder: 0,
  IsActive: true
};

const EmptyPersonForm = {
  Name: "",
  UserId: "",
  Notes: ""
};

const Builder = () => {
  const { categories, dropdowns, people, status, error, reloadCatalog } =
    useLifeAdminCatalog({ includeInactive: true });
  const { users } = useLifeAdminUsers();
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const { fields, reloadFields } = useLifeAdminFields(activeCategoryId);
  const { options, reloadOptions } = useLifeAdminDropdownOptions(activeDropdownId);
  const [actionStatus, setActionStatus] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [activeModal, setActiveModal] = useState(null);

  const [categoryForm, setCategoryForm] = useState(EmptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [fieldForm, setFieldForm] = useState(EmptyFieldForm);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [dropdownForm, setDropdownForm] = useState(EmptyDropdownForm);
  const [editingDropdownId, setEditingDropdownId] = useState(null);
  const [optionForm, setOptionForm] = useState(EmptyOptionForm);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [personForm, setPersonForm] = useState(EmptyPersonForm);
  const [editingPersonId, setEditingPersonId] = useState(null);

  useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      setActiveCategoryId(categories[0].Id);
    }
  }, [categories, activeCategoryId]);

  useEffect(() => {
    if (!activeDropdownId && dropdowns.length > 0) {
      setActiveDropdownId(dropdowns[0].Id);
    }
  }, [dropdowns, activeDropdownId]);

  const activeCategory = useMemo(
    () => categories.find((entry) => entry.Id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );
  const activeDropdown = useMemo(
    () => dropdowns.find((entry) => entry.Id === activeDropdownId) || null,
    [dropdowns, activeDropdownId]
  );

  const onCategoryFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCategoryForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onFieldFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFieldForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onDropdownFormChange = (event) => {
    const { name, value } = event.target;
    setDropdownForm((prev) => ({ ...prev, [name]: value }));
  };

  const onOptionFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setOptionForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onPersonFormChange = (event) => {
    const { name, value } = event.target;
    setPersonForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetCategoryForm = () => {
    setCategoryForm(EmptyCategoryForm);
    setEditingCategoryId(null);
  };

  const resetFieldForm = () => {
    setFieldForm(EmptyFieldForm);
    setEditingFieldId(null);
  };

  const resetDropdownForm = () => {
    setDropdownForm(EmptyDropdownForm);
    setEditingDropdownId(null);
  };

  const resetOptionForm = () => {
    setOptionForm(EmptyOptionForm);
    setEditingOptionId(null);
  };

  const resetPersonForm = () => {
    setPersonForm(EmptyPersonForm);
    setEditingPersonId(null);
  };

  const openCategoryModal = () => {
    resetCategoryForm();
    setActiveModal("category");
  };

  const closeCategoryModal = () => {
    resetCategoryForm();
    setActiveModal(null);
  };

  const openFieldModal = () => {
    if (!activeCategoryId) {
      setActionError("Select a category before adding fields.");
      return;
    }
    resetFieldForm();
    setActiveModal("field");
  };

  const closeFieldModal = () => {
    resetFieldForm();
    setActiveModal(null);
  };

  const openDropdownModal = () => {
    resetDropdownForm();
    setActiveModal("dropdown");
  };

  const closeDropdownModal = () => {
    resetDropdownForm();
    setActiveModal(null);
  };

  const openOptionModal = () => {
    if (!activeDropdownId) {
      setActionError("Select a dropdown before adding options.");
      return;
    }
    resetOptionForm();
    setActiveModal("option");
  };

  const closeOptionModal = () => {
    resetOptionForm();
    setActiveModal(null);
  };

  const openPersonModal = () => {
    resetPersonForm();
    setActiveModal("person");
  };

  const closePersonModal = () => {
    resetPersonForm();
    setActiveModal(null);
  };

  const onEditCategory = (category) => {
    setEditingCategoryId(category.Id);
    setCategoryForm({
      Name: category.Name,
      Description: category.Description || "",
      SortOrder: category.SortOrder || 0,
      IsActive: Boolean(category.IsActive)
    });
    setActiveModal("category");
  };

  const onEditField = (field) => {
    setEditingFieldId(field.Id);
    setFieldForm({
      Name: field.Name,
      Key: field.Key || "",
      FieldType: field.FieldType,
      IsRequired: Boolean(field.IsRequired),
      IsMulti: Boolean(field.IsMulti),
      SortOrder: field.SortOrder || 0,
      DropdownId: field.DropdownId ? String(field.DropdownId) : "",
      LinkedCategoryId: field.LinkedCategoryId ? String(field.LinkedCategoryId) : "",
      Config: field.Config || {}
    });
    setActiveModal("field");
  };

  const onEditDropdown = (dropdown) => {
    setEditingDropdownId(dropdown.Id);
    setDropdownForm({
      Name: dropdown.Name,
      Description: dropdown.Description || ""
    });
    setActiveModal("dropdown");
  };

  const onEditOption = (option) => {
    setEditingOptionId(option.Id);
    setOptionForm({
      Label: option.Label,
      Value: option.Value || "",
      SortOrder: option.SortOrder || 0,
      IsActive: Boolean(option.IsActive)
    });
    setActiveModal("option");
  };

  const onEditPerson = (person) => {
    setEditingPersonId(person.Id);
    setPersonForm({
      Name: person.Name,
      UserId: person.UserId ? String(person.UserId) : "",
      Notes: person.Notes || ""
    });
    setActiveModal("person");
  };

  const handleAction = async (handler) => {
    try {
      setActionStatus("saving");
      setActionError("");
      await handler();
      setActionStatus("ready");
      return true;
    } catch (err) {
      setActionStatus("error");
      setActionError(err?.message || "Something went wrong");
      return false;
    }
  };

  const onSaveCategory = async (event) => {
    event.preventDefault();
    const success = await handleAction(async () => {
      if (editingCategoryId) {
        await UpdateLifeCategory(editingCategoryId, categoryForm);
      } else {
        const created = await CreateLifeCategory(categoryForm);
        setActiveCategoryId(created.Id);
      }
      resetCategoryForm();
      await reloadCatalog();
    });
    if (success) {
      closeCategoryModal();
    }
  };

  const onSaveField = async (event) => {
    event.preventDefault();
    if (!activeCategoryId) {
      setActionError("Select a category to add fields.");
      return;
    }
    const success = await handleAction(async () => {
      const payload = {
        ...fieldForm,
        DropdownId: fieldForm.DropdownId ? Number(fieldForm.DropdownId) : null,
        LinkedCategoryId: fieldForm.LinkedCategoryId ? Number(fieldForm.LinkedCategoryId) : null
      };
      if (editingFieldId) {
        await UpdateLifeField(editingFieldId, payload);
      } else {
        await CreateLifeField(activeCategoryId, payload);
      }
      resetFieldForm();
      await reloadFields();
    });
    if (success) {
      closeFieldModal();
    }
  };

  const onSaveDropdown = async (event) => {
    event.preventDefault();
    const success = await handleAction(async () => {
      if (editingDropdownId) {
        await UpdateLifeDropdown(editingDropdownId, dropdownForm);
      } else {
        const created = await CreateLifeDropdown(dropdownForm);
        setActiveDropdownId(created.Id);
      }
      resetDropdownForm();
      await reloadCatalog();
    });
    if (success) {
      closeDropdownModal();
    }
  };

  const onSaveOption = async (event) => {
    event.preventDefault();
    if (!activeDropdownId) {
      setActionError("Select a dropdown before adding options.");
      return;
    }
    const success = await handleAction(async () => {
      if (editingOptionId) {
        await UpdateLifeDropdownOption(editingOptionId, optionForm);
      } else {
        await CreateLifeDropdownOption(activeDropdownId, optionForm);
      }
      resetOptionForm();
      await reloadOptions();
    });
    if (success) {
      closeOptionModal();
    }
  };

  const onSavePerson = async (event) => {
    event.preventDefault();
    const success = await handleAction(async () => {
      const payload = {
        ...personForm,
        UserId: personForm.UserId ? Number(personForm.UserId) : null
      };
      if (editingPersonId) {
        await UpdateLifePerson(editingPersonId, payload);
      } else {
        await CreateLifePerson(payload);
      }
      resetPersonForm();
      await reloadCatalog();
    });
    if (success) {
      closePersonModal();
    }
  };

  const onDeleteCategory = async (category) => {
    const confirmed = window.confirm(
      `Delete ${category.Name}? This removes all fields and records in this category. This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    const success = await handleAction(async () => {
      await DeleteLifeCategory(category.Id);
      if (activeCategoryId === category.Id) {
        setActiveCategoryId(null);
      }
      await reloadCatalog();
    });
    if (success && editingCategoryId === category.Id) {
      closeCategoryModal();
    }
  };

  const onDeleteField = async (field) => {
    const confirmed = window.confirm(
      `Delete ${field.Name}? Records keep existing values but the column will be removed.`
    );
    if (!confirmed) {
      return;
    }
    const success = await handleAction(async () => {
      await DeleteLifeField(field.Id);
      await reloadFields();
    });
    if (success && editingFieldId === field.Id) {
      closeFieldModal();
    }
  };

  return (
    <div className="budget-subgrid">
      <section className="module-panel">
        <div className="module-panel-header">
          <div>
            <h3>Categories</h3>
            <p className="lede">Create the tabs that organize your life admin data.</p>
          </div>
          <div className="module-panel-actions">
            <button type="button" className="primary-button" onClick={openCategoryModal}>
              Add category
            </button>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {actionError ? <p className="form-error">{actionError}</p> : null}
        <div className="income-table-section">
          <div className="income-table-header">
            <h4>Existing categories</h4>
            <p>Pick a category to edit its fields below.</p>
          </div>
          {categories.length === 0 ? (
            <p className="form-note">No categories yet.</p>
          ) : (
            <div className="table-shell">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.Id}>
                        <td>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setActiveCategoryId(category.Id)}
                          >
                            {category.Name}
                          </button>
                        </td>
                        <td>{category.IsActive ? "Active" : "Hidden"}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => onEditCategory(category)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => onDeleteCategory(category)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="module-panel">
        <div className="module-panel-header">
          <div>
            <h3>Fields</h3>
            <p className="lede">Define the columns that appear in each category.</p>
          </div>
          <div className="module-panel-actions">
            <select
              value={activeCategoryId || ""}
              onChange={(event) => setActiveCategoryId(Number(event.target.value))}
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories.map((category) => (
                <option key={category.Id} value={category.Id}>
                  {category.Name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="primary-button"
              onClick={openFieldModal}
              disabled={!activeCategory}
            >
              Add field
            </button>
          </div>
        </div>
        {!activeCategory ? (
          <p className="form-note">Choose a category to configure its fields.</p>
        ) : (
          <div className="income-table-section">
            <div className="income-table-header">
              <h4>Existing fields</h4>
              <p>{activeCategory.Name} fields in order.</p>
            </div>
            {fields.length === 0 ? (
              <p className="form-note">No fields yet.</p>
            ) : (
              <div className="table-shell">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Key</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field) => (
                        <tr key={field.Id}>
                          <td>{field.Name}</td>
                          <td>{field.Key}</td>
                          <td>{field.FieldType}</td>
                          <td>{field.IsRequired ? "Yes" : "No"}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => onEditField(field)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => onDeleteField(field)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="module-panel">
        <div className="module-panel-header">
          <div>
            <h3>Dropdowns</h3>
            <p className="lede">Reusable option lists for dropdown fields.</p>
          </div>
          <div className="module-panel-actions">
            <button type="button" className="primary-button" onClick={openDropdownModal}>
              Add dropdown
            </button>
          </div>
        </div>
        <div className="income-table-section">
          <div className="income-table-header">
            <h4>Dropdown lists</h4>
            <p>Select a list to manage its options.</p>
          </div>
          {dropdowns.length === 0 ? (
            <p className="form-note">No dropdowns yet.</p>
          ) : (
            <div className="table-shell">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dropdowns.map((dropdown) => (
                      <tr key={dropdown.Id}>
                        <td>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setActiveDropdownId(dropdown.Id)}
                          >
                            {dropdown.Name}
                          </button>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => onEditDropdown(dropdown)}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {activeDropdown ? (
          <div className="income-table-section">
            <div className="module-panel-header">
              <div>
                <h4>Options for {activeDropdown.Name}</h4>
                <p>Keep labels short and clear.</p>
              </div>
              <div className="module-panel-actions">
                <button type="button" className="primary-button" onClick={openOptionModal}>
                  Add option
                </button>
              </div>
            </div>
            {options.length === 0 ? (
              <p className="form-note">No options yet.</p>
            ) : (
              <div className="table-shell">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {options.map((option) => (
                        <tr key={option.Id}>
                          <td>{option.Label}</td>
                        <td>{option.IsActive ? "Active" : "Hidden"}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => onEditOption(option)}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="module-panel">
        <div className="module-panel-header">
          <div>
            <h3>People</h3>
            <p className="lede">Add people for person picker fields.</p>
          </div>
          <div className="module-panel-actions">
            <button type="button" className="primary-button" onClick={openPersonModal}>
              Add person
            </button>
          </div>
        </div>
        {people.length === 0 ? (
          <p className="form-note">No people yet.</p>
        ) : (
          <div className="table-shell">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Linked user</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.Id}>
                      <td>{person.Name}</td>
                      <td>{person.UserId ? `User ${person.UserId}` : "None"}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onEditPerson(person)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      {status === "loading" ? <p className="form-note">Loading builder data.</p> : null}
      {activeModal === "category" ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeCategoryModal}
        >
          <div className="modal life-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingCategoryId ? "Edit category" : "Add category"}</h3>
                <p>Categories become tabs in life admin.</p>
              </div>
              <button type="button" className="text-button" onClick={closeCategoryModal}>
                Close
              </button>
            </div>
            {actionError ? <p className="form-error">{actionError}</p> : null}
            <form className="form-grid" onSubmit={onSaveCategory}>
              <label title="The tab name shown in Life admin.">
                Name
                <input
                  name="Name"
                  value={categoryForm.Name}
                  onChange={onCategoryFormChange}
                  required
                />
              </label>
              <label title="Optional helper text shown on the records view.">
                Description
                <textarea
                  name="Description"
                  value={categoryForm.Description}
                  onChange={onCategoryFormChange}
                />
              </label>
              <label title="Lower numbers appear earlier in the tab list.">
                Sort order
                <input
                  name="SortOrder"
                  type="number"
                  value={categoryForm.SortOrder}
                  onChange={onCategoryFormChange}
                />
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Active</span>
                <span className="form-switch">
                  <input
                    type="checkbox"
                    name="IsActive"
                    checked={categoryForm.IsActive}
                    onChange={onCategoryFormChange}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </span>
              </label>
              <div className="form-actions">
                <button type="submit" disabled={actionStatus === "saving"}>
                  {editingCategoryId ? "Save category" : "Add category"}
                </button>
                <button type="button" className="button-secondary" onClick={closeCategoryModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {activeModal === "field" ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeFieldModal}>
          <div className="modal life-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingFieldId ? "Edit field" : "Add field"}</h3>
                <p>{activeCategory ? `Category: ${activeCategory.Name}` : "Select a category first."}</p>
              </div>
              <button type="button" className="text-button" onClick={closeFieldModal}>
                Close
              </button>
            </div>
            {actionError ? <p className="form-error">{actionError}</p> : null}
            <form className="form-grid" onSubmit={onSaveField}>
              <label title="The column label shown in records and lists.">
                Label
                <input name="Name" value={fieldForm.Name} onChange={onFieldFormChange} required />
              </label>
              <label title="Stable identifier used to store values. Leave blank to auto-generate.">
                Key
                <input name="Key" value={fieldForm.Key} onChange={onFieldFormChange} />
              </label>
              <label title="Controls how values are captured.">
                Field type
                <select name="FieldType" value={fieldForm.FieldType} onChange={onFieldFormChange}>
                  {FieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              {fieldForm.FieldType === "Dropdown" ? (
                <label title="Choose a shared option list.">
                  Dropdown
                  <select name="DropdownId" value={fieldForm.DropdownId} onChange={onFieldFormChange}>
                    <option value="">Select a dropdown</option>
                    {dropdowns.map((dropdown) => (
                      <option key={dropdown.Id} value={dropdown.Id}>
                        {dropdown.Name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {fieldForm.FieldType === "RecordLink" ? (
                <label title="Choose which category to link to.">
                  Linked category
                  <select
                    name="LinkedCategoryId"
                    value={fieldForm.LinkedCategoryId}
                    onChange={onFieldFormChange}
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.Id} value={category.Id}>
                        {category.Name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label title="Lower numbers appear earlier in the table.">
                Sort order
                <input
                  name="SortOrder"
                  type="number"
                  value={fieldForm.SortOrder}
                  onChange={onFieldFormChange}
                />
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Required</span>
                <span className="form-switch">
                  <input
                    type="checkbox"
                    name="IsRequired"
                    checked={fieldForm.IsRequired}
                    onChange={onFieldFormChange}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </span>
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Allow multiple values</span>
                <span className="form-switch">
                  <input
                    type="checkbox"
                    name="IsMulti"
                    checked={fieldForm.IsMulti}
                    onChange={onFieldFormChange}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </span>
              </label>
              <div className="form-actions">
                <button type="submit" disabled={actionStatus === "saving"}>
                  {editingFieldId ? "Save field" : "Add field"}
                </button>
                <button type="button" className="button-secondary" onClick={closeFieldModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {activeModal === "dropdown" ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeDropdownModal}
        >
          <div className="modal life-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingDropdownId ? "Edit dropdown" : "Add dropdown"}</h3>
                <p>Create reusable lists for dropdown fields.</p>
              </div>
              <button type="button" className="text-button" onClick={closeDropdownModal}>
                Close
              </button>
            </div>
            {actionError ? <p className="form-error">{actionError}</p> : null}
            <form className="form-grid" onSubmit={onSaveDropdown}>
              <label title="The list name shown in the builder.">
                Name
                <input
                  name="Name"
                  value={dropdownForm.Name}
                  onChange={onDropdownFormChange}
                  required
                />
              </label>
              <label title="Optional description for the list.">
                Description
                <textarea
                  name="Description"
                  value={dropdownForm.Description}
                  onChange={onDropdownFormChange}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={actionStatus === "saving"}>
                  {editingDropdownId ? "Save dropdown" : "Add dropdown"}
                </button>
                <button type="button" className="button-secondary" onClick={closeDropdownModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {activeModal === "option" ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeOptionModal}>
          <div className="modal life-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingOptionId ? "Edit option" : "Add option"}</h3>
                <p>{activeDropdown ? `Dropdown: ${activeDropdown.Name}` : "Select a dropdown first."}</p>
              </div>
              <button type="button" className="text-button" onClick={closeOptionModal}>
                Close
              </button>
            </div>
            {actionError ? <p className="form-error">{actionError}</p> : null}
            <form className="form-grid" onSubmit={onSaveOption}>
              <label title="Label shown in dropdown menus.">
                Label
                <input name="Label" value={optionForm.Label} onChange={onOptionFormChange} required />
              </label>
              <label title="Optional stored value for exports or integrations.">
                Value
                <input name="Value" value={optionForm.Value} onChange={onOptionFormChange} />
              </label>
              <label title="Lower numbers appear earlier in the list.">
                Sort order
                <input
                  name="SortOrder"
                  type="number"
                  value={optionForm.SortOrder}
                  onChange={onOptionFormChange}
                />
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Active</span>
                <span className="form-switch">
                  <input
                    type="checkbox"
                    name="IsActive"
                    checked={optionForm.IsActive}
                    onChange={onOptionFormChange}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </span>
              </label>
              <div className="form-actions">
                <button type="submit" disabled={actionStatus === "saving"}>
                  {editingOptionId ? "Save option" : "Add option"}
                </button>
                <button type="button" className="button-secondary" onClick={closeOptionModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {activeModal === "person" ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closePersonModal}>
          <div className="modal life-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingPersonId ? "Edit person" : "Add person"}</h3>
                <p>People can be linked to records and users.</p>
              </div>
              <button type="button" className="text-button" onClick={closePersonModal}>
                Close
              </button>
            </div>
            {actionError ? <p className="form-error">{actionError}</p> : null}
            <form className="form-grid" onSubmit={onSavePerson}>
              <label>
                Name
                <input name="Name" value={personForm.Name} onChange={onPersonFormChange} required />
              </label>
              <label>
                Linked user
                <select name="UserId" value={personForm.UserId} onChange={onPersonFormChange}>
                  <option value="">No linked user</option>
                  {users.map((user) => (
                    <option key={user.Id} value={user.Id}>
                      {user.FirstName || user.Username}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notes
                <textarea name="Notes" value={personForm.Notes} onChange={onPersonFormChange} />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={actionStatus === "saving"}>
                  {editingPersonId ? "Save person" : "Add person"}
                </button>
                <button type="button" className="button-secondary" onClick={closePersonModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Builder;
