import { RequestJson } from "./apiClient.js";

export const FetchLifeCategories = async (includeInactive = false) => {
  const query = includeInactive ? "?include_inactive=true" : "";
  return RequestJson(`/life-admin/categories${query}`);
};

export const CreateLifeCategory = async (payload) => {
  return RequestJson("/life-admin/categories", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateLifeCategory = async (categoryId, payload) => {
  return RequestJson(`/life-admin/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteLifeCategory = async (categoryId) => {
  return RequestJson(`/life-admin/categories/${categoryId}`, {
    method: "DELETE"
  });
};

export const FetchLifeFields = async (categoryId) => {
  return RequestJson(`/life-admin/categories/${categoryId}/fields`);
};

export const CreateLifeField = async (categoryId, payload) => {
  return RequestJson(`/life-admin/categories/${categoryId}/fields`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateLifeField = async (fieldId, payload) => {
  return RequestJson(`/life-admin/fields/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteLifeField = async (fieldId) => {
  return RequestJson(`/life-admin/fields/${fieldId}`, {
    method: "DELETE"
  });
};

export const FetchLifeDropdowns = async () => {
  return RequestJson("/life-admin/dropdowns");
};

export const CreateLifeDropdown = async (payload) => {
  return RequestJson("/life-admin/dropdowns", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateLifeDropdown = async (dropdownId, payload) => {
  return RequestJson(`/life-admin/dropdowns/${dropdownId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteLifeDropdown = async (dropdownId) => {
  return RequestJson(`/life-admin/dropdowns/${dropdownId}`, {
    method: "DELETE"
  });
};

export const FetchLifeDropdownOptions = async (dropdownId) => {
  return RequestJson(`/life-admin/dropdowns/${dropdownId}/options`);
};

export const CreateLifeDropdownOption = async (dropdownId, payload) => {
  return RequestJson(`/life-admin/dropdowns/${dropdownId}/options`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateLifeDropdownOption = async (optionId, payload) => {
  return RequestJson(`/life-admin/dropdowns/options/${optionId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const FetchLifePeople = async () => {
  return RequestJson("/life-admin/people");
};

export const CreateLifePerson = async (payload) => {
  return RequestJson("/life-admin/people", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateLifePerson = async (personId, payload) => {
  return RequestJson(`/life-admin/people/${personId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const FetchLifeRecords = async (categoryId) => {
  return RequestJson(`/life-admin/categories/${categoryId}/records`);
};

export const CreateLifeRecord = async (categoryId, payload) => {
  return RequestJson(`/life-admin/categories/${categoryId}/records`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const UpdateLifeRecord = async (recordId, payload) => {
  return RequestJson(`/life-admin/records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const DeleteLifeRecord = async (recordId) => {
  return RequestJson(`/life-admin/records/${recordId}`, {
    method: "DELETE"
  });
};

export const FetchLifeRecordLookup = async (categoryId) => {
  return RequestJson(`/life-admin/categories/${categoryId}/records/lookup`);
};
