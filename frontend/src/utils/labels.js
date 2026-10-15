// Turkish labels and badge colors for the enum values the API uses.
// Each map mirrors a CHECK constraint in the backend migrations; an
// unknown value always falls back to the raw value.

export const CUSTOMER_STATUS = {
  ACTIVE: { label: "Aktif", tone: "green" },
  INACTIVE: { label: "Pasif", tone: "neutral" },
  CANCELLED: { label: "İptal", tone: "red" },
};

export const REGISTRATION_STATUS = {
  REGISTERED: { label: "Kayıtlı", tone: "blue" },
  CONFIRMED: { label: "Onaylandı", tone: "green" },
  CANCELLED: { label: "İptal", tone: "red" },
  COMPLETED: { label: "Tamamlandı", tone: "neutral" },
};

export const PAYMENT_STATUS = {
  UNPAID: { label: "Ödenmedi", tone: "red" },
  PARTIALLY_PAID: { label: "Kısmen ödendi", tone: "orange" },
  PAID: { label: "Ödendi", tone: "green" },
  REFUNDED: { label: "İade edildi", tone: "neutral" },
};

export const FLIGHT_STATUS = {
  SCHEDULED: { label: "Planlandı", tone: "blue" },
  DELAYED: { label: "Gecikmeli", tone: "orange" },
  CANCELLED: { label: "İptal", tone: "red" },
  COMPLETED: { label: "Tamamlandı", tone: "neutral" },
};

export const HOTEL_STATUS = {
  PENDING: { label: "Beklemede", tone: "orange" },
  CONFIRMED: { label: "Onaylandı", tone: "blue" },
  CANCELLED: { label: "İptal", tone: "red" },
  COMPLETED: { label: "Tamamlandı", tone: "neutral" },
};

export const TRANSACTION_TYPE = {
  INCOME: { label: "Gelir", tone: "green" },
  EXPENSE: { label: "Gider", tone: "red" },
  REFUND: { label: "İade", tone: "orange" },
};

export const TRANSACTION_STATUS = {
  PENDING: { label: "Beklemede", tone: "orange" },
  COMPLETED: { label: "Tamamlandı", tone: "green" },
  CANCELLED: { label: "İptal", tone: "neutral" },
};

// Categories allowed per transaction type (finance_transactions_type_category_check).
export const TRANSACTION_CATEGORIES = {
  INCOME: ["PARTICIPANT_PAYMENT", "TOUR_SALE"],
  EXPENSE: ["HOTEL", "FLIGHT", "TRANSPORT", "FOOD", "GUIDE", "ACTIVITY", "INSURANCE", "VISA", "OTHER"],
  REFUND: ["PARTICIPANT_REFUND"],
};

export const CATEGORY_LABELS = {
  PARTICIPANT_PAYMENT: "Katılımcı Ödemesi",
  TOUR_SALE: "Tur Satışı",
  HOTEL: "Otel",
  FLIGHT: "Uçuş",
  TRANSPORT: "Ulaşım",
  FOOD: "Yemek",
  GUIDE: "Rehber",
  ACTIVITY: "Aktivite",
  INSURANCE: "Sigorta",
  VISA: "Vize",
  OTHER: "Diğer",
  PARTICIPANT_REFUND: "Katılımcı İadesi",
};

export const CURRENCIES = ["TRY", "EUR", "USD", "GBP"];

export const DOCUMENT_CATEGORY = {
  PASSPORT: "Pasaport",
  TICKET: "Bilet",
  VISA: "Vize",
  PROGRAM: "Program",
  CONTRACT: "Sözleşme",
  INSURANCE: "Sigorta",
  OTHER: "Diğer",
};

export const DOCUMENT_VISIBILITY = {
  COMPANY_ONLY: "Yalnızca şirket",
  PARTICIPANT: "Katılımcı",
  BOTH: "Şirket ve katılımcı",
};

export const DOCUMENT_STATUS = {
  ACTIVE: { label: "Aktif", tone: "green" },
  ARCHIVED: { label: "Arşivlendi", tone: "neutral" },
};

export const ANNOUNCEMENT_STATUS = {
  DRAFT: { label: "Taslak", tone: "neutral" },
  PUBLISHED: { label: "Yayında", tone: "green" },
  ARCHIVED: { label: "Arşivlendi", tone: "neutral" },
};

export const ANNOUNCEMENT_PRIORITY = {
  LOW: { label: "Düşük", tone: "neutral" },
  NORMAL: { label: "Normal", tone: "blue" },
  HIGH: { label: "Yüksek", tone: "orange" },
  URGENT: { label: "Acil", tone: "red" },
};

export const MEMBER_STATUS = {
  ACTIVE: { label: "Aktif", tone: "green" },
  INACTIVE: { label: "Pasif", tone: "neutral" },
  SUSPENDED: { label: "Askıya alındı", tone: "red" },
};

export const ROLE_LABELS = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  MANAGER: "Operasyon Müdürü",
  STAFF: "Personel",
  VIEWER: "Görüntüleyici",
};

export function labelOf(map, value) {
  const entry = map[value];
  if (!entry) return value || "-";
  return typeof entry === "string" ? entry : entry.label;
}
