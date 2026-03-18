const express = require('express');
const upload = require('../middleware/multer.middleware');
const {
  productValidationRules,
  updateProductValidationRules,
  catalogFiltersValidation,
  handleValidationErrors,
} = require('../middleware/validation.middleware');
const createAuthMiddleware = require('../middleware/auth.middleware');
const {
  createProduct,
  getProduct,
  getCatalog,
  updateProduct,
  deleteProduct,
  getSellerProducts,
  getAllProducts,
} = require('../controllers/product.controller');

const router = express.Router();

/**
 * IMPORTANT: Route order matters! More specific routes must come before generic ones
 */

// GET /api/products/seller/products - Seller's product list (must be before /:id)
router.get(
  '/seller/products',
  createAuthMiddleware(['admin', 'seller']),
  catalogFiltersValidation(),
  handleValidationErrors,
  getSellerProducts
);

// POST /api/products - Create product (SELLER)
router.post(
  '/',
  createAuthMiddleware(['admin', 'seller']),
  upload.array('images', 5),
  productValidationRules(),
  handleValidationErrors,
  createProduct
);

// GET /api/products - Catalog listing with search, filters, pagination, sort
router.get(
  '/',
  catalogFiltersValidation(),
  handleValidationErrors,
  getCatalog
);

// PATCH /api/products/:id - Update product (SELLER)
router.patch(
  '/:id',
  createAuthMiddleware(['admin', 'seller']),
  updateProductValidationRules(),
  handleValidationErrors,
  updateProduct
);

// DELETE /api/products/:id - Delete product (SELLER)
router.delete(
  '/:id',
  createAuthMiddleware(['admin', 'seller']),
  deleteProduct
);

// GET /api/products/:id - Product details, cacheable by id (must be last GET)
router.get('/:id', getProduct);

module.exports = router;