const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: "İstenen endpoint bulunamadı." },
  });
};

module.exports = notFoundHandler;
