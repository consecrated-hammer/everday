import { RequestJson } from "./apiClient.js";

const ShoppingBase = "/shopping/items";

export const FetchShoppingItems = (householdId) =>
  RequestJson(`${ShoppingBase}?household_id=${encodeURIComponent(householdId)}`);

export const CreateShoppingItem = (payload) =>
  RequestJson(ShoppingBase, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const UpdateShoppingItem = (itemId, payload, householdId) =>
  RequestJson(`${ShoppingBase}/${itemId}?household_id=${encodeURIComponent(householdId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const DeleteShoppingItem = (itemId, householdId) =>
  RequestJson(`${ShoppingBase}/${itemId}?household_id=${encodeURIComponent(householdId)}`, {
    method: "DELETE"
  });
