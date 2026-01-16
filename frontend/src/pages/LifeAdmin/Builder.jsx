import { useEffect, useMemo, useRef, useState } from "react";

import Icon from "../../components/Icon.jsx";
import {
  CreateLifeCategory,
  CreateLifeDropdown,
  CreateLifeDropdownOption,
  CreateLifeField,
  CreateLifePerson,
  DeleteLifeCategory,
  DeleteLifeDropdown,
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

const BuilderTabs = [
  { key: "schema", label: "Schema" },
  { key: "dropdowns", label: "Dropdowns" },
  { key: "people", label: "People" }
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

const BuildCategoryLabel = (category) => {
  const count = category?.RecordCount;
  if (typeof count !== "number") {
    return category.Name;
  }
  return `${category.Name} (${count})`;
};

const BuildStatusLabel = (isActive) => (isActive ? "Active" : "Hidden");

const Builder = () => {
  const { categories, dropdowns, people, status, error, reloadCatalog } =
    useLifeAdminCatalog({ includeInactive: true });
  const { users } = useLifeAdminUsers();
  const [activeTab, setActiveTab] = useState("schema");
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const { fields, reloadFields } = useLifeAdminFields(activeCategoryId);
  const { options, reloadOptions } = useLifeAdminDropdownOptions(activeDropdownId);
  const [actionStatus, setActionStatus] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const builderRef = useRef(null);

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
    if (activeCategoryId && !categories.some((entry) => entry.Id === activeCategoryId)) {
      setActiveCategoryId(null);
    }
  }, [categories, activeCategoryId]);

  useEffect(() => {
    if (activeDropdownId && !dropdowns.some((entry) => entry.Id === activeDropdownId)) {
      setActiveDropdownId(null);
    }
  }, [dropdowns, activeDropdownId]);

  useEffect(() => {
    setOpenMenu(null);
    setMenuPosition(null);
  }, [activeTab]);

  useEffect(() => {
    const onClick = (event) => {
      if (!builderRef.current || !builderRef.current.contains(event.target)) {
        setOpenMenu(null);
        setMenuPosition(null);
        return;
      }
      if (event.target.closest(".life-admin-row-menu")) {
        return;
      }
      setOpenMenu(null);
      setMenuPosition(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const activeCategory = useMemo(
    () => categories.find((entry) => entry.Id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );
  const activeDropdown = useMemo(
    () => dropdowns.find((entry) => entry.Id === activeDropdownId) || null,
    [dropdowns, activeDropdownId]
  );
  const editingDropdown = useMemo(
    () => dropdowns.find((entry) => entry.Id === editingDropdownId) || null,
    [dropdowns, editingDropdownId]
  );

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) {
      return categories;
    }
    return categories.filter((category) => category.Name.toLowerCase().includes(query));
  }, [categories, categorySearch]);

  const filteredDropdowns = useMemo(() => {
    const query = dropdownSearch.trim().toLowerCase();
    if (!query) {
      return dropdowns;
    }
    return dropdowns.filter((dropdown) => dropdown.Name.toLowerCase().includes(query));
  }, [dropdowns, dropdownSearch]);

  const filteredPeople = useMemo(() => {
    const query = peopleSearch.trim().toLowerCase();
    if (!query) {
      return people;
    }
    return people.filter((person) => person.Name.toLowerCase().includes(query));
  }, [people, peopleSearch]);

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

  const onDeleteDropdown = async () => {
    if (!editingDropdownId) {
      return;
    }
    const dropdown = dropdowns.find((entry) => entry.Id === editingDropdownId);
    if (!dropdown) {
      return;
    }
    const confirmed = window.confirm(
      `Delete ${dropdown.Name}? This will remove the dropdown and its options.`
    );
    if (!confirmed) {
      return;
    }
    const success = await handleAction(async () => {
      await DeleteLifeDropdown(editingDropdownId);
      if (activeDropdownId === editingDropdownId) {
        setActiveDropdownId(null);
      }
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

  const onToggleCategoryActive = async (category) => {
    const nextActive = !category.IsActive;
    const success = await handleAction(async () => {
      await UpdateLifeCategory(category.Id, {
        Name: category.Name,
        Description: category.Description || "",
        SortOrder: category.SortOrder || 0,
        IsActive: nextActive
      });
      await reloadCatalog();
    });
    if (success && editingCategoryId === category.Id && !nextActive) {
      closeCategoryModal();
    }
  };

  const onToggleOptionActive = async (option) => {
    const nextActive = !option.IsActive;
    const success = await handleAction(async () => {
      await UpdateLifeDropdownOption(option.Id, {
        Label: option.Label,
        Value: option.Value || "",
        SortOrder: option.SortOrder || 0,
        IsActive: nextActive
      });
      await reloadOptions();
    });
    if (success && editingOptionId === option.Id && !nextActive) {
      closeOptionModal();
    }
  };

  const toggleMenu = (type, id, event) => {
    event.stopPropagation();
    if (openMenu?.type === type && openMenu?.id === id) {
      setOpenMenu(null);
      setMenuPosition(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setOpenMenu({ type, id });
    setMenuPosition({
      top: Math.round(rect.bottom + 6),
      right: Math.max(12, Math.round(window.innerWidth - rect.right))
    });
  };

  const isMenuOpen = (type, id) => openMenu?.type === type && openMenu?.id === id;

  return (
    <div className="life-admin-builder" ref={builderRef}>
      <div className="life-admin-builder-header">
        <div>
          <h3>Builder</h3>
          <p className="lede">Manage categories, fields, dropdowns, and people.</p>
        </div>
      </div>
      <div className="life-admin-tabs life-admin-tabs--underline" role="tablist" aria-label="Life admin builder tabs">
        {BuilderTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`life-admin-tab${activeTab === tab.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {actionError ? <p className="form-error">{actionError}</p> : null}
      {status === "loading" ? <p className="form-note">Loading builder data.</p> : null}

      {activeTab === "schema" ? (
        <div className="life-admin-builder-grid">
          <section className="module-panel life-admin-panel">
            <div className="module-panel-header">
              <div>
                <h3>Categories</h3>
                <p className="lede">Organize your records by topic.</p>
              </div>
              <div className="module-panel-actions">
                <button type="button" className="primary-button" onClick={openCategoryModal}>
                  Add category
                </button>
              </div>
            </div>
            <div className="life-admin-panel-body">
              <label className="life-admin-search" aria-label="Search categories">
                <Icon name="search" className="icon" />
                <input
                  placeholder="Search"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                />
              </label>
              <div className="life-admin-panel-scroll">
                {filteredCategories.length === 0 ? (
                  <p className="form-note">No categories yet.</p>
                ) : (
                  <div className="life-admin-list">
                    {filteredCategories.map((category) => {
                      const isSelected = category.Id === activeCategoryId;
                      return (
                        <div
                          key={category.Id}
                          className={`life-admin-list-row${isSelected ? " is-selected" : ""}`}
                        >
                          <button
                            type="button"
                            className="life-admin-list-button"
                            onClick={() => setActiveCategoryId(category.Id)}
                            aria-pressed={isSelected}
                          >
                            <span className="life-admin-list-leading">
                              <span
                                className={`life-admin-status-dot${
                                  category.IsActive ? " is-active" : " is-inactive"
                                }`}
                                title={BuildStatusLabel(category.IsActive)}
                              />
                            </span>
                            <span className="life-admin-list-name">{BuildCategoryLabel(category)}</span>
                          </button>
                          <div className="toolbar-flyout life-admin-row-menu">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label="Category actions"
                              onClick={(event) => toggleMenu("category", category.Id, event)}
                            >
                              <Icon name="more" className="icon" />
                            </button>
                            {isMenuOpen("category", category.Id) ? (
                              <div
                                className="dropdown life-admin-context-menu"
                                style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : undefined}
                              >
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setOpenMenu(null);
                                    setMenuPosition(null);
                                    onEditCategory(category);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setOpenMenu(null);
                                    setMenuPosition(null);
                                    onToggleCategoryActive(category);
                                  }}
                                >
                                  {category.IsActive ? "Disable" : "Enable"}
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-item is-danger"
                                  onClick={() => {
                                    setOpenMenu(null);
                                    setMenuPosition(null);
                                    onDeleteCategory(category);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="module-panel life-admin-panel">
            <div className="module-panel-header">
              <div>
                <h3>
                  {activeCategory ? `Editing category: ${activeCategory.Name}` : "Fields"}
                </h3>
                <p className="lede">Define the columns within each category.</p>
                {activeCategory && typeof activeCategory.RecordCount === "number" ? (
                  <span className="life-admin-meta">Records: {activeCategory.RecordCount}</span>
                ) : null}
              </div>
              <div className="module-panel-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => activeCategory && onEditCategory(activeCategory)}
                  disabled={!activeCategory}
                >
                  Edit category
                </button>
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
            <div className="life-admin-panel-body">
              {!activeCategory ? (
                <p className="form-note">Select a category to view its fields.</p>
              ) : fields.length === 0 ? (
                <p className="form-note">No fields yet.</p>
              ) : (
                <div className="table-shell life-admin-panel-scroll">
                  <div className="table-wrap">
                    <table className="life-admin-table">
                      <thead>
                        <tr>
                          <th>Label</th>
                          <th>Type</th>
                          <th>Required</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field) => (
                          <tr key={field.Id}>
                            <td>
                              <span className="life-admin-field-label">
                                <Icon name="drag" className="icon life-admin-field-handle" />
                                {field.Name}
                              </span>
                            </td>
                            <td>{field.FieldType}</td>
                            <td>{field.IsRequired ? "Yes" : "No"}</td>
                            <td className="life-admin-actions-cell">
                              <div className="toolbar-flyout life-admin-row-menu">
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label="Field actions"
                                  onClick={(event) => toggleMenu("field", field.Id, event)}
                                >
                                  <Icon name="more" className="icon" />
                                </button>
                                {isMenuOpen("field", field.Id) ? (
                                  <div
                                    className="dropdown life-admin-context-menu"
                                    style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : undefined}
                                  >
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => {
                                        setOpenMenu(null);
                                        setMenuPosition(null);
                                        onEditField(field);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="dropdown-item is-danger"
                                      onClick={() => {
                                        setOpenMenu(null);
                                        setMenuPosition(null);
                                        onDeleteField(field);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
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
        </div>
      ) : null}

      {activeTab === "dropdowns" ? (
        <div className="life-admin-builder-grid">
          <section className="module-panel life-admin-panel">
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
            <div className="life-admin-panel-body">
              <label className="life-admin-search" aria-label="Search dropdowns">
                <Icon name="search" className="icon" />
                <input
                  placeholder="Search"
                  value={dropdownSearch}
                  onChange={(event) => setDropdownSearch(event.target.value)}
                />
              </label>
              <div className="life-admin-panel-scroll">
                {filteredDropdowns.length === 0 ? (
                  <p className="form-note">No dropdowns yet.</p>
                ) : (
                  <div className="life-admin-list">
                    {filteredDropdowns.map((dropdown) => {
                      const isSelected = dropdown.Id === activeDropdownId;
                      return (
                        <div
                          key={dropdown.Id}
                          className={`life-admin-list-row${isSelected ? " is-selected" : ""}`}
                        >
                          <button
                            type="button"
                            className="life-admin-list-button"
                            onClick={() => setActiveDropdownId(dropdown.Id)}
                            aria-pressed={isSelected}
                          >
                            <span className="life-admin-list-name">{dropdown.Name}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="module-panel life-admin-panel">
            <div className="module-panel-header">
              <div>
                <h3>{activeDropdown ? `Options for: ${activeDropdown.Name}` : "Options"}</h3>
                <p className="lede">Manage the labels within each dropdown list.</p>
              </div>
              <div className="module-panel-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => activeDropdown && onEditDropdown(activeDropdown)}
                  disabled={!activeDropdown}
                >
                  Edit dropdown
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={openOptionModal}
                  disabled={!activeDropdown}
                >
                  Add option
                </button>
              </div>
            </div>
            <div className="life-admin-panel-body">
              {!activeDropdown ? (
                <p className="form-note">Select a dropdown to view its options.</p>
              ) : options.length === 0 ? (
                <p className="form-note">No options yet.</p>
              ) : (
                <div className="table-shell life-admin-panel-scroll">
                  <div className="table-wrap">
                    <table className="life-admin-table">
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
                            <td className="life-admin-actions-cell">
                              <div className="toolbar-flyout life-admin-row-menu">
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label="Option actions"
                                  onClick={(event) => toggleMenu("option", option.Id, event)}
                                >
                                  <Icon name="more" className="icon" />
                                </button>
                                {isMenuOpen("option", option.Id) ? (
                                  <div
                                    className="dropdown life-admin-context-menu"
                                    style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : undefined}
                                  >
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => {
                                        setOpenMenu(null);
                                        setMenuPosition(null);
                                        onEditOption(option);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => {
                                        setOpenMenu(null);
                                        setMenuPosition(null);
                                        onToggleOptionActive(option);
                                      }}
                                    >
                                      {option.IsActive ? "Disable" : "Enable"}
                                    </button>
                                  </div>
                                ) : null}
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
        </div>
      ) : null}

      {activeTab === "people" ? (
        <section className="module-panel life-admin-panel">
          <div className="module-panel-header">
            <div>
              <h3>People</h3>
              <p className="lede">Use people in person picker fields.</p>
            </div>
            <div className="module-panel-actions">
              <button type="button" className="primary-button" onClick={openPersonModal}>
                Add person
              </button>
            </div>
          </div>
          <div className="life-admin-panel-body">
            <label className="life-admin-search" aria-label="Search people">
              <Icon name="search" className="icon" />
              <input
                placeholder="Search"
                value={peopleSearch}
                onChange={(event) => setPeopleSearch(event.target.value)}
              />
            </label>
            {filteredPeople.length === 0 ? (
              <p className="form-note">No people yet.</p>
            ) : (
              <div className="table-shell life-admin-panel-scroll">
                <div className="table-wrap">
                  <table className="life-admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Linked user</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeople.map((person) => (
                        <tr key={person.Id}>
                          <td>{person.Name}</td>
                          <td>{person.UserId ? `User ${person.UserId}` : "None"}</td>
                          <td className="life-admin-actions-cell">
                            <div className="toolbar-flyout life-admin-row-menu">
                              <button
                                type="button"
                                className="icon-button"
                                aria-label="Person actions"
                                onClick={(event) => toggleMenu("person", person.Id, event)}
                              >
                                <Icon name="more" className="icon" />
                              </button>
                              {isMenuOpen("person", person.Id) ? (
                                <div
                                  className="dropdown life-admin-context-menu"
                                  style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : undefined}
                                >
                                  <button
                                    type="button"
                                    className="dropdown-item"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      setMenuPosition(null);
                                      onEditPerson(person);
                                    }}
                                  >
                                    Edit
                                  </button>
                                </div>
                              ) : null}
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
      ) : null}

      {activeModal === "category" ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeCategoryModal}>
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
                <input name="Name" value={categoryForm.Name} onChange={onCategoryFormChange} required />
              </label>
              <label title="Optional helper text shown on the records view.">
                Description
                <textarea name="Description" value={categoryForm.Description} onChange={onCategoryFormChange} />
              </label>
              <label title="Lower numbers appear earlier in the tab list.">
                Sort order
                <input name="SortOrder" type="number" value={categoryForm.SortOrder} onChange={onCategoryFormChange} />
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Active</span>
                <span className="form-switch">
                  <input type="checkbox" name="IsActive" checked={categoryForm.IsActive} onChange={onCategoryFormChange} />
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
                  <select name="LinkedCategoryId" value={fieldForm.LinkedCategoryId} onChange={onFieldFormChange}>
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
                <input name="SortOrder" type="number" value={fieldForm.SortOrder} onChange={onFieldFormChange} />
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Required</span>
                <span className="form-switch">
                  <input type="checkbox" name="IsRequired" checked={fieldForm.IsRequired} onChange={onFieldFormChange} />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </span>
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Allow multiple values</span>
                <span className="form-switch">
                  <input type="checkbox" name="IsMulti" checked={fieldForm.IsMulti} onChange={onFieldFormChange} />
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeDropdownModal}>
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
                <input name="Name" value={dropdownForm.Name} onChange={onDropdownFormChange} required />
              </label>
              <label title="Optional description for the list.">
                Description
                <textarea name="Description" value={dropdownForm.Description} onChange={onDropdownFormChange} />
              </label>
              {editingDropdownId && editingDropdown?.InUseCount ? (
                <p className="form-note">
                  Delete is disabled while this dropdown is used by {editingDropdown.InUseCount} field
                  {editingDropdown.InUseCount === 1 ? "" : "s"}.
                </p>
              ) : null}
              <div className="form-actions">
                <button type="submit" disabled={actionStatus === "saving"}>
                  {editingDropdownId ? "Save dropdown" : "Add dropdown"}
                </button>
                <button type="button" className="button-secondary" onClick={closeDropdownModal}>
                  Cancel
                </button>
                {editingDropdownId ? (
                  <button
                    type="button"
                    className="button-danger"
                    onClick={onDeleteDropdown}
                    disabled={actionStatus === "saving" || (editingDropdown?.InUseCount || 0) > 0}
                  >
                    Delete dropdown
                  </button>
                ) : null}
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
                <input name="SortOrder" type="number" value={optionForm.SortOrder} onChange={onOptionFormChange} />
              </label>
              <label className="form-switch-row form-switch-row--inline">
                <span className="form-switch-label">Active</span>
                <span className="form-switch">
                  <input type="checkbox" name="IsActive" checked={optionForm.IsActive} onChange={onOptionFormChange} />
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
