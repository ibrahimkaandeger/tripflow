// Uses the backend's pagination block ({ page, totalPages, total }).
// Hidden when everything fits on one page.
function Pagination({ pagination, onPageChange, unit = "kayıt" }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;

  return (
    <nav className="pagination" aria-label="Sayfalama">
      <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Önceki
      </button>
      <span className="muted small">
        Sayfa {page} / {totalPages} · Toplam {total} {unit}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Sonraki
      </button>
    </nav>
  );
}

export default Pagination;
