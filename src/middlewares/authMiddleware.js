const jwt = require("jsonwebtoken");
const { User } = require("../models");

const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    // Không có header
    if (!header) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Check định dạng "Bearer <token>"
    const parts = header.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res
        .status(401)
        .json({ message: "Invalid Authorization format. Use Bearer <token>" });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ message: "Token missing" });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm user trong DB
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Gắn user info vào request
    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (err) {
    console.error(err);

    // Phân loại lỗi JWT
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired, please login again" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    return res.status(401).json({ message: "Unauthorized", error: err.message });
  }
};

// Middleware phân quyền theo role
const authorizeRole = (roles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

module.exports = { authMiddleware, authorizeRole };
