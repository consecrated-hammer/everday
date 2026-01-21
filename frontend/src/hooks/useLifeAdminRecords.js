import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FetchLifeDropdownOptions,
  FetchLifeRecordLookup,
  FetchLifeRecords
} from "../lib/lifeAdminApi.js";

const GetLinkedCategoryIds = (fields) => {
  const ids = new Set();
  fields.forEach((field) => {
    if (field.FieldType === "RecordLink" && field.LinkedCategoryId) {
      ids.add(field.LinkedCategoryId);
    }
  });
  return Array.from(ids);
};

const GetDropdownIds = (fields) => {
  const ids = new Set();
  fields.forEach((field) => {
    if (field.FieldType === "Dropdown" && field.DropdownId) {
      ids.add(field.DropdownId);
    }
  });
  return Array.from(ids);
};

export const useLifeAdminRecords = (categoryId, fields) => {
  const [records, setRecords] = useState([]);
  const [recordStatus, setRecordStatus] = useState("idle");
  const [recordError, setRecordError] = useState("");
  const [recordLookups, setRecordLookups] = useState({});
  const [dropdownOptions, setDropdownOptions] = useState({});

  const linkedCategoryIds = useMemo(() => GetLinkedCategoryIds(fields), [fields]);
  const dropdownIds = useMemo(() => GetDropdownIds(fields), [fields]);

  const loadRecords = useCallback(async () => {
    if (!categoryId) {
      setRecords([]);
      return;
    }
    try {
      setRecordStatus("loading");
      setRecordError("");
      const nextRecords = await FetchLifeRecords(categoryId);
      setRecords(nextRecords);
      setRecordStatus("ready");
    } catch (err) {
      setRecordStatus("error");
      setRecordError(err?.message || "Failed to load records");
    }
  }, [categoryId]);

  const loadLookups = useCallback(async () => {
    if (linkedCategoryIds.length === 0) {
      setRecordLookups({});
      return;
    }
    const results = await Promise.all(
      linkedCategoryIds.map(async (id) => [id, await FetchLifeRecordLookup(id)])
    );
    const nextLookup = {};
    results.forEach(([id, items]) => {
      nextLookup[id] = items;
    });
    setRecordLookups(nextLookup);
  }, [linkedCategoryIds]);

  const loadDropdownOptions = useCallback(async () => {
    if (dropdownIds.length === 0) {
      setDropdownOptions({});
      return;
    }
    const results = await Promise.all(
      dropdownIds.map(async (id) => [id, await FetchLifeDropdownOptions(id)])
    );
    const nextOptions = {};
    results.forEach(([id, items]) => {
      nextOptions[id] = items;
    });
    setDropdownOptions(nextOptions);
  }, [dropdownIds]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadDropdownOptions();
  }, [loadDropdownOptions]);

  return {
    records,
    recordStatus,
    recordError,
    recordLookups,
    dropdownOptions,
    reloadRecords: loadRecords
  };
};
