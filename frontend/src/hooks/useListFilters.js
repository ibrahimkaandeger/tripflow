import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "./useDebouncedValue";

// Common state for the company-wide list pages: page number, a search
// box (debounced), and arbitrary select filters. The tour filter lives
// in the URL (?tour=12) so "see this tour's documents" links work.
export function useListFilters(initial = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(initial);
  const debouncedSearch = useDebouncedValue(search.trim());

  const tour = searchParams.get("tour") || "";

  function setTour(value) {
    setSearchParams(value ? { tour: value } : {}, { replace: true });
    setPage(1);
  }

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  // Only non-empty values become query parameters.
  const params = { page, limit: 20, tour: tour || undefined, search: debouncedSearch || undefined };
  for (const [name, value] of Object.entries(filters)) {
    if (value) params[name] = value;
  }

  const isFiltered = Boolean(tour || debouncedSearch || Object.values(filters).some(Boolean));

  return { params, page, setPage, search, setSearch: updateSearch, tour, setTour, filters, setFilter, isFiltered };
}
