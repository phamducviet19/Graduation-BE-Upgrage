// sync.js
const sequelize = require("./src/config/db"); // đường dẫn đến file config bạn vừa gửi
require("dotenv").config();

async function syncDatabase() {
  try {
    await sequelize.sync({ force: true }); // xóa & tạo lại toàn bộ bảng
    console.log("✅ Database synced successfully!");
  } catch (error) {
    console.error("❌ Error syncing database:", error);
  } finally {
    await sequelize.close();
  }
}

syncDatabase();
