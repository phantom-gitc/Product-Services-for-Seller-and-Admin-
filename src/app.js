const express = require('express');
const cookieParser = require('cookie-parser');
const productRoutes = require('./routes/product.routes');






const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/api/products', productRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

module.exports = app;