const app = require('./app');
const { sequelize } = require('./models');


const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ DB connected`);
    app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
})();
