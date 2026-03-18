const { body, validationResult, query } = require('express-validator');

/**
 * Validation Rules for Product Creation
 */
const productValidationRules = () => [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3 })
    .withMessage('Title must be at least 3 characters long')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),

  body('description')
    .trim()
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('price.amount')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('price.currency')
    .optional()
    .isIn(['USD', 'INR'])
    .withMessage('Currency must be USD or INR'),

  body('seller')
    .notEmpty()
    .withMessage('Seller ID is required')
    .isMongoId()
    .withMessage('Seller ID must be a valid MongoDB ObjectId'),

  body('category')
    .optional()
    .isIn(['electronics', 'fashion', 'home', 'books', 'sports', 'other'])
    .withMessage('Invalid category'),

  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

/**
 * Validation Rules for Product Update
 */
const updateProductValidationRules = () => [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3-100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('price.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('price.currency')
    .optional()
    .isIn(['USD', 'INR'])
    .withMessage('Currency must be USD or INR'),

  body('category')
    .optional()
    .isIn(['electronics', 'fashion', 'home', 'books', 'sports', 'other'])
    .withMessage('Invalid category'),

  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('status')
    .optional()
    .isIn(['active', 'archived', 'draft'])
    .withMessage('Invalid status'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

/**
 * Validation Rules for Catalog Filters
 */
const catalogFiltersValidation = () => [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search query must not be empty'),

  query('category')
    .optional()
    .isIn(['electronics', 'fashion', 'home', 'books', 'sports', 'other'])
    .withMessage('Invalid category'),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be positive'),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be positive'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),

  query('sort')
    .optional()
    .isIn(['price_asc', 'price_desc', 'newest', 'rating'])
    .withMessage('Invalid sort option'),
];

/**
 * Validation middleware to check for errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.param,
      message: error.msg,
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formattedErrors,
    });
  }

  next();
};

module.exports = {
  productValidationRules,
  updateProductValidationRules,
  catalogFiltersValidation,
  handleValidationErrors,
};
