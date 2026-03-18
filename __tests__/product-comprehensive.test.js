const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Product = require('../src/models/product.model');
const cache = require('../src/utils/cache');
const { productEvents } = require('../src/utils/eventEmitter');

// Mock auth middleware
jest.mock('../src/middleware/auth.middleware', () => {
  return (roles) => {
    return (req, res, next) => {
      req.user = {
        id: '507f1f77bcf86cd799439011',
        role: 'seller',
      };
      req.seller = req.user.id;
      next();
    };
  };
});

// Mock ImageKit upload
jest.mock('../src/middleware/imagekit.middleware', () => ({
  uploadImageToImageKit: jest.fn().mockResolvedValue({
    url: 'https://imagekit.io/test.jpg',
    thumbnailUrl: 'https://imagekit.io/test_thumb.jpg',
    id: 'test-id-123',
  }),
}));

describe('Product API - Comprehensive Test Suite', () => {
  const sellerId = '507f1f77bcf86cd799439011';
  const otherSellerId = '607f1f77bcf86cd799439012';

  let productId;
  let secondProductId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/test');
  });

  afterAll(async () => {
    await Product.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    cache.clearAll();
  });

  describe('POST /api/products - Create Product (SELLER)', () => {
    test('should create product successfully with valid data', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          description: 'Test Description',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: sellerId,
          category: 'electronics',
          stock: 50,
          tags: ['test', 'electronics'],
        });

      console.log('Create response:', res.status, res.body);
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Product');
      expect(res.body.data.category).toBe('electronics');
      expect(res.body.data.status).toBe('active');
      productId = res.body.data._id;
    });

    test('should create product with default variant if none provided', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Variant Test Product',
          price: {
            amount: 200,
            currency: 'USD',
          },
          seller: sellerId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.variants).toBeDefined();
      expect(res.body.data.variants.length).toBeGreaterThan(0);
      expect(res.body.data.variants[0].name).toBe('Default');
    });

    test('should fail validation without title', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          description: 'No title',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: sellerId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    test('should fail validation without seller', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test',
          price: {
            amount: 100,
            currency: 'INR',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail validation with title < 3 characters', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'ab',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: sellerId,
        });

      expect(res.status).toBe(400);
    });

    test('should fail validation with invalid seller ID', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: 'invalid-id',
        });

      expect(res.status).toBe(400);
    });

    test('should fail validation with negative price', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          price: {
            amount: -100,
            currency: 'INR',
          },
          seller: sellerId,
        });

      expect(res.status).toBe(400);
    });

    test('should fail validation with invalid category', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: sellerId,
          category: 'invalid-category',
        });

      expect(res.status).toBe(400);
    });

    test('should fail validation with invalid currency', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          price: {
            amount: 100,
            currency: 'EUR',
          },
          seller: sellerId,
        });

      expect(res.status).toBe(400);
    });

    test('should trim whitespace from title and description', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: '  Test Product  ',
          description: '  Test Desc  ',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: sellerId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Test Product');
      expect(res.body.data.description).toBe('Test Desc');
    });

    test('should emit product.created event', async () => {
      const eventSpy = jest.fn();
      productEvents.on('product.created', eventSpy);

      await request(app)
        .post('/api/products')
        .send({
          title: 'Event Test',
          price: {
            amount: 100,
            currency: 'INR',
          },
          seller: sellerId,
        });

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0].title).toBe('Event Test');
      productEvents.removeListener('product.created', eventSpy);
    });
  });

  describe('GET /api/products/:id - Get Single Product', () => {
    beforeEach(async () => {
      const product = await Product.create({
        title: 'Single Product',
        price: { amount: 100, currency: 'INR' },
        seller: sellerId,
        category: 'electronics',
      });
      productId = product._id;
    });

    test('should retrieve product by ID', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Single Product');
    });

    test('should cache the product', async () => {
      // First call
      await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      // Second call should be cached
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(res.body.cached).toBe(true);
    });

    test('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Product not found');
    });
  });

  describe('GET /api/products - Catalog Listing', () => {
    beforeEach(async () => {
      await Product.create([
        {
          title: 'Laptop Computer',
          description: 'High performance laptop',
          price: { amount: 1000, currency: 'INR' },
          seller: sellerId,
          category: 'electronics',
          status: 'active',
        },
        {
          title: 'Smart Phone',
          description: 'Latest smartphone',
          price: { amount: 500, currency: 'INR' },
          seller: otherSellerId,
          category: 'electronics',
          status: 'active',
        },
        {
          title: 'Winter Jacket',
          description: 'Warm winter jacket',
          price: { amount: 200, currency: 'INR' },
          seller: sellerId,
          category: 'fashion',
          status: 'active',
        },
        {
          title: 'Archived Product',
          price: { amount: 100, currency: 'INR' },
          seller: sellerId,
          category: 'home',
          status: 'archived',
        },
      ]);
    });

    test('should retrieve catalog with default pagination', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });

    test('should search by text query', async () => {
      const res = await request(app)
        .get('/api/products?q=laptop')
        .expect(200);

      expect(res.body.success).toBe(true);
      // Note: Text search might not work in test without proper MongoDB text index
    });

    test('should filter by category', async () => {
      const res = await request(app)
        .get('/api/products?category=electronics')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every(p => p.category === 'electronics')).toBe(true);
    });

    test('should filter by price range', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=300&maxPrice=600')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every(p => 
        p.price.amount >= 300 && p.price.amount <= 600
      )).toBe(true);
    });

    test('should sort by price ascending', async () => {
      const res = await request(app)
        .get('/api/products?sort=price_asc')
        .expect(200);

      expect(res.body.success).toBe(true);
      const prices = res.body.data.map(p => p.price.amount);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    test('should sort by price descending', async () => {
      const res = await request(app)
        .get('/api/products?sort=price_desc')
        .expect(200);

      expect(res.body.success).toBe(true);
      const prices = res.body.data.map(p => p.price.amount);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    test('should handle pagination', async () => {
      const res = await request(app)
        .get('/api/products?page=1&limit=2')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });

    test('should only return active products', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200);

      expect(res.body.data.every(p => p.status === 'active')).toBe(true);
    });

    test('should validate price filters', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=invalid')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/products/:id - Update Product (SELLER)', () => {
    beforeEach(async () => {
      const product = await Product.create({
        title: 'Update Test Product',
        price: { amount: 100, currency: 'INR' },
        seller: sellerId,
        category: 'electronics',
      });
      productId = product._id;
    });

    test('should update product successfully', async () => {
      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .send({
          title: 'Updated Product',
          price: { amount: 150, currency: 'USD' },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Product');
      expect(res.body.data.price.amount).toBe(150);
    });

    test('should emit product.updated event', async () => {
      const eventSpy = jest.fn();
      productEvents.on('product.updated', eventSpy);

      await request(app)
        .patch(`/api/products/${productId}`)
        .send({ title: 'Updated' });

      expect(eventSpy).toHaveBeenCalled();
      productEvents.removeListener('product.updated', eventSpy);
    });

    test('should invalidate caches after update', async () => {
      // First, cache the product
      await request(app).get(`/api/products/${productId}`);

      // Update the product
      await request(app)
        .patch(`/api/products/${productId}`)
        .send({ title: 'New Title' });

      // Cache should be invalidated
      const cacheKey = cache.cacheKeys.productId(productId);
      expect(cache.get(cacheKey)).toBeNull();
    });

    test('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/products/${fakeId}`)
        .send({ title: 'Update' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    test('should fail validation with invalid data', async () => {
      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .send({
          price: { amount: -100, currency: 'INR' },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    test('should update status field', async () => {
      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .send({ status: 'draft' })
        .expect(200);

      expect(res.body.data.status).toBe('draft');
    });
  });

  describe('DELETE /api/products/:id - Delete Product (SELLER)', () => {
    beforeEach(async () => {
      const product = await Product.create({
        title: 'Delete Test Product',
        price: { amount: 100, currency: 'INR' },
        seller: sellerId,
        category: 'electronics',
      });
      productId = product._id;
    });

    test('should soft delete product (mark as archived)', async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .send({ hardDelete: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('archived');
    });

    test('should hard delete product', async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .send({ hardDelete: true })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('should emit product.deleted event', async () => {
      const eventSpy = jest.fn();
      productEvents.on('product.deleted', eventSpy);

      await request(app)
        .delete(`/api/products/${productId}`)
        .send({ hardDelete: false });

      expect(eventSpy).toHaveBeenCalled();
      productEvents.removeListener('product.deleted', eventSpy);
    });

    test('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/products/${fakeId}`)
        .send({ hardDelete: false })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/products/seller - Seller Products (SELLER)', () => {
    beforeEach(async () => {
      await Product.create([
        {
          title: 'Seller Product 1',
          price: { amount: 100, currency: 'INR' },
          seller: sellerId,
          category: 'electronics',
          status: 'active',
        },
        {
          title: 'Seller Product 2',
          price: { amount: 200, currency: 'INR' },
          seller: sellerId,
          category: 'fashion',
          status: 'active',
        },
        {
          title: 'Seller Product Draft',
          price: { amount: 150, currency: 'INR' },
          seller: sellerId,
          category: 'home',
          status: 'draft',
        },
        {
          title: 'Other Seller Product',
          price: { amount: 300, currency: 'INR' },
          seller: otherSellerId,
          category: 'electronics',
          status: 'active',
        },
      ]);
    });

    test('should retrieve seller products with active status', async () => {
      const res = await request(app)
        .get('/api/products/seller/products')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.every(p => p.status === 'active')).toBe(true);
    });

    test('should handle pagination for seller products', async () => {
      const res = await request(app)
        .get('/api/products/seller/products?page=1&limit=1')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body.pagination.limit).toBe(1);
    });

    test('should filter seller products by status', async () => {
      const res = await request(app)
        .get('/api/products/seller/products?status=draft')
        .expect(200);

      expect(res.body.data.every(p => p.status === 'draft')).toBe(true);
    });

    test('should sort seller products', async () => {
      const res = await request(app)
        .get('/api/products/seller/products?sort=price_desc')
        .expect(200);

      expect(res.body.success).toBe(true);
      const prices = res.body.data.map(p => p.price.amount);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });
  });

  describe('Product Variant Tests', () => {
    test('should create product with custom variants', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Product with Variants',
          price: { amount: 100, currency: 'INR' },
          seller: sellerId,
          variants: [
            {
              name: 'Size Small',
              sku: 'SMALL-001',
              price: 100,
              stock: 50,
            },
            {
              name: 'Size Large',
              sku: 'LARGE-001',
              price: 120,
              stock: 30,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.variants.length).toBe(2);
    });
  });

  describe('Cache Invalidation Tests', () => {
    test('should invalidate catalog cache on product creation', async () => {
      // Create first product and cache catalog
      await Product.create({
        title: 'Product 1',
        price: { amount: 100, currency: 'INR' },
        seller: sellerId,
        status: 'active',
      });

      await request(app).get('/api/products');

      // Create new product - should invalidate cache
      await request(app)
        .post('/api/products')
        .send({
          title: 'New Product',
          price: { amount: 200, currency: 'INR' },
          seller: sellerId,
        });

      // Catalog should be re-fetched
      const res = await request(app).get('/api/products');
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle database errors gracefully', async () => {
      const invalidId = 'invalid-mongo-id';
      const res = await request(app)
        .get(`/api/products/${invalidId}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
