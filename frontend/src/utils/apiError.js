// Turns an Axios error into a message a user can act on. Business
// endpoints answer { error: { code, message } } and the auth endpoints
// the older flat { message }; both are understood. Backend validation
// messages (400/409/422) are already user-facing Turkish text, so they
// are shown as-is.
export function describeApiError(error, { notFound = "Kayıt bulunamadı." } = {}) {
  if (!error?.response) {
    return "Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin.";
  }

  const { status, data } = error.response;
  const code = data?.error?.code;
  const message = data?.error?.message || data?.message;

  if (status === 401) {
    return "Oturumunuz geçersiz olabilir. Lütfen tekrar giriş yapın.";
  }
  if (code === "COMPANY_CONTEXT_REQUIRED") {
    return "Bu işlem için bir şirkete bağlı olmanız gerekiyor.";
  }
  if (code === "NOT_COMPANY_MEMBER" || code === "MEMBERSHIP_INACTIVE") {
    return "Şirket üyeliğiniz bulunamadı veya aktif değil.";
  }
  if (code === "PERMISSION_DENIED") {
    return message || "Bu işlem için yetkiniz yok.";
  }
  if (status === 403) {
    return message || "Bu işlem için yetkiniz yok.";
  }
  if (status === 404) {
    return notFound;
  }
  if (status >= 500) {
    return "Sunucuda beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.";
  }

  return message || "İşlem sırasında bir hata oluştu.";
}

// True when the response carried the standard list envelope.
export function isListResponse(body) {
  return (
    body?.success === true &&
    Array.isArray(body.data) &&
    typeof body.pagination?.totalPages === "number"
  );
}
