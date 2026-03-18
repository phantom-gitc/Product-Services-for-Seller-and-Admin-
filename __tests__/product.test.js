const request = require('supertest');
const express = require('express');
const Product = require('../src/models/product.model');
const imagekitMiddleware = require('../src/middleware/imagekit.middleware');
const cache = require('../src/utils/cache');

// Mock dependencies
jest.mock('../src/models/product.model');
jest.mock('../src/middleware/imagekit.middleware');
jest.mock('../src/middleware/auth.middleware', () => {
  return () => (req, res, next) => next();
});

describe('Product Controller - Integration Tests with Express Validator', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Setup routes with middleware
    const productRoutes = require('../src/routes/product.routes');
    app.use('/api/products', productRoutes);

    jest.clearAllMocks();
    // Clear cache between tests
    cache.clearAll();
  });

  describe('POST /api/products - Create Product', () => {
    it('should create a product successfully with valid data', async () => {
      const mockUploadedImages = [
        {
          url: 'https://ik.imagekit.io/test/image1.jpg',
          thumbnailUrl: 'https://ik.imagekit.io/test/tr:w-100/image1.jpg',
          id: 'file-id-1',
        },
      ];

      const mockSavedProduct = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Product',
        description: 'A test product',
        price: {
          amount: 100,
          currency: 'INR',
        },
        seller: '507f1f77bcf86cd799439011',
        images: mockUploadedImages,
        save: jest.fn().mockResolvedValue(true),
      };

      imagekitMiddleware.uploadImageToImageKit.mockResolvedValueOnce(
        mockUploadedImages[0]
      );

      Product.mockImplementation(() => mockSavedProduct);

      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Product created successfully');
    });

    it('should create product without images', async () => {
      const mockSavedProduct = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Product',
        description: 'A test product',
        price: {
          amount: 100,
          currency: 'INR',
        },
        seller: '507f1f77bcf86cd799439011',
        images: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Product.mockImplementation(() => mockSavedProduct);

      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should fail without title', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          description: 'A test product',
          price: 100,
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should fail without seller', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          price: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should fail without price', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should fail with invalid seller ID format', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          price: 100,
          seller: 'invalid-mongo-id',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should fail with title less than 3 characters', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'ab',
          description: 'A test product',
          price: 100,
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should fail with title exceeding 100 characters', async () => {
      const longTitle = 'A'.repeat(101);
      const res = await request(app)
        .post('/api/products')
        .send({
          title: longTitle,
          description: 'A test product',
          price: 100,
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should fail with negative price', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          price: -100,
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should fail with invalid currency', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          price: 100,
          currency: 'EUR',
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should trim whitespace from title and description', async () => {
      const mockSavedProduct = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Product',
        description: 'A test product',
        price: {
          amount: 100,
          currency: 'INR',
        },
        seller: '507f1f77bcf86cd799439011',
        images: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Product.mockImplementation(() => mockSavedProduct);

      const res = await request(app)
        .post('/api/products')
        .send({
          title: '  Test Product  ',
          description: '  A test product  ',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(201);
      expect(mockSavedProduct.save).toHaveBeenCalled();
    });

    it('should handle database save errors', async () => {
      const saveError = new Error('Database connection failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockSavedProduct = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Product',
        description: 'A test product',
        price: {
          amount: 100,
          currency: 'INR',
        },
        seller: '507f1f77bcf86cd799439011',
        images: [],
        save: jest.fn().mockRejectedValueOnce(saveError),
      };

      Product.mockImplementation(() => mockSavedProduct);

      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'A test product',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /api/products/:id - Get Single Product', () => {
    it('should retrieve a product by ID', async () => {
      const mockProduct = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Product',
        description: 'A test product',
        price: {
          amount: 100,
          currency: 'INR',
        },
        seller: '507f1f77bcf86cd799439011',
        images: [],
      };

      Product.findById.mockResolvedValueOnce(mockProduct);

      const res = await request(app).get('/api/products/507f1f77bcf86cd799439012');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockProduct);
    });

    it('should return 404 when product not found', async () => {
      Product.findById.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/products/507f1f77bcf86cd799439012');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Product not found');
    });

    it('should handle database errors in getProduct', async () => {
      const dbError = new Error('Database query failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      Product.findById.mockRejectedValueOnce(dbError);

      const res = await request(app).get('/api/products/507f1f77bcf86cd799439012');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /api/products - Get All Products', () => {
    it('should retrieve all products with default pagination', async () => {
      const mockProducts = [
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Product 1',
          price: { amount: 100, currency: 'INR' },
          seller: '507f1f77bcf86cd799439011',
        },
        {
          _id: '507f1f77bcf86cd799439013',
          title: 'Product 2',
          price: { amount: 200, currency: 'INR' },
          seller: '507f1f77bcf86cd799439011',
        },
      ];

      const chainableQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValueOnce(chainableQuery);
      Product.countDocuments.mockResolvedValueOnce(2);

      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockProducts);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });

    it('should filter products by seller', async () => {
      const sellerId = '507f1f77bcf86cd799439011';
      const mockProducts = [
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Product 1',
          seller: sellerId,
        },
      ];

      const chainableQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValueOnce(chainableQuery);
      Product.countDocuments.mockResolvedValueOnce(1);

      const res = await request(app).get(`/api/products?seller=${sellerId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle custom pagination', async () => {
      const mockProducts = [];

      const chainableQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValueOnce(chainableQuery);
      Product.countDocuments.mockResolvedValueOnce(50);

      const res = await request(app).get('/api/products?page=2&limit=25');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(25);
      expect(res.body.pagination.pages).toBe(2);
    });
  });
});
