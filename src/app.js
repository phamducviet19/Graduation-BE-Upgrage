const express = require('express');
const cors = require('cors');
const swaggerDocs = require("./swagger");
require('dotenv').config();
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const brandRoutes = require('./routes/brandRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const profileRoutes = require('./routes/profileRoutes');
const cartRoutes = require('./routes/cartRoutes');
const attributeRoutes = require('./routes/attrbuteRoutes');
const productRoutes = require('./routes/productRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const customerRoutes = require('./routes/customerRoutes');
const importRoutes = require('./routes/importRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlishRoutes = require('./routes/wishlishRoutes');
const compareRoutes = require('./routes/compareRoutes');
const pcBuildRoutes = require('./routes/pcBuildRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api/auth', authRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/attribute', attributeRoutes);
app.use('/api/product', productRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/import', importRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/wishlist', wishlishRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/pcbuild', pcBuildRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

swaggerDocs(app, process.env.PORT || 5000);

module.exports = app;