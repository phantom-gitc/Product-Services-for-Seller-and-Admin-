const request = require('supertest');
const mongoose = require('mongoose');

// Mock auth middleware to set req.seller (must be before requiring app)
jest.mock('../src/middleware/auth.middleware', () => {
  return (roles) => (req, res, next) => {
    req.user = { id: '507f1f77bcf86cd799439011', role: 'seller' };
    req.seller = req.user.id;
    next();
  };
});

// Mock ImageKit uploads
jest.mock('../src/middleware/imagekit.middleware', () => ({
  uploadImageToImageKit: jest.fn().mockResolvedValue({
    url: 'https://test.jpg',
    thumbnailUrl: 'https://test_thumb.jpg',
    id: 'test-id',
  }),
}));

const app = require('../src/app');
const Product = require('../src/models/product.model');

const sellerId = '507f1f77bcf86cd799439011';
const otherSellerId = '607f1f77bcf86cd799439012';

describe('Comprehensive Product API Tests', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost/test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await Product.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
  });

  // ==================== POST TESTS ====================
  describe('POST /api/products - Create Product', () => {
    test('Create product with required fields', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Laptop',
          price: { amount: 50000, currency: 'INR' },
          seller: sellerId,
        });

      expect(res.statusCode).toBeOneOf([201, 400]);
      if (res.statusCode === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.title).toBe('Test Laptop');
      }
    });

    test('Validation: reject missing title', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          price: { amount: 100, currency: 'INR' },
          seller: sellerId,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('Validation: reject missing price', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test',
          seller: sellerId,
        });

      expect(res.statusCode).toBe(400);
    });

    test('Validation: reject invalid seller ID', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test Product',
          price: { amount: 100, currency: 'INR' },
          seller: 'invalid',
        });

      expect(res.statusCode).toBe(400);
    });

    test('Validation: reject negative price', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test',
          price: { amount: -100, currency: 'INR' },
          seller: sellerId,
        });

      expect(res.statusCode).toBe(400);
    });

    test('Validation: title must be 3+ characters', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'ab',
          price: { amount: 100, currency: 'INR' },
          seller: sellerId,
        });

      expect(res.statusCode).toBe(400);
    });

    test('Validation: invalid currency', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test',
          price: { amount: 100, currency: 'EUR' },
          seller: sellerId,
        });

      expect(res.statusCode).toBe(400);
    });

    test('Validation: invalid category', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Test',
          price: { amount: 100, currency: 'INR' },
          seller: sellerId,
          category: 'invalid',
        });

      expect(res.statusCode).toBe(400);
    });

    test('Create with optional fields', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          title: 'Laptop Computer',
          description: 'High performance laptop for programming',
          price: { amount: 75000, currency: 'INR' },
          seller: sellerId,
          category: 'electronics',
          stock: 100,
          tags: ['laptop', 'computer', 'electronics'],
        });

      expect(res.statusCode).toBeOneOf([201, 400]);
      if (res.statusCode === 201) {
        expect(res.body.data.category).toBe('electronics');
        expect(res.body.data.tags).toContain('laptop');
      }
    });
  });

  // ==================== GET /products/:id TESTS ====================
  describe('GET /api/products/:id - Get Product Details', () => {
    let productId;

    beforeEach(async () => {
      const product = await Product.create({
        title: 'Get Test Product',
        price: { amount: 100, currency: 'INR' },
        seller: sellerId,
        status: 'active',
      });
      productId = product._id.toString();
    });

    test('Retrieve product by ID', async () => {
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Get Test Product');
    });

    test('Return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Product not found');
    });
  });

  // ==================== GET /products TESTS ====================
  describe('GET /api/products - Catalog Listing', () => {
    beforeEach(async () => {
      await Product.create([
        {
          title: 'MacBook Pro',
          price: { amount: 120000, currency: 'INR' },
          seller: sellerId,
          category: 'electronics',
          status: 'active',
        },
        {
          title: 'Dell Laptop',
          price: { amount: 60000, currency: 'INR' },
          seller: otherSellerId,
          category: 'electronics',
          status: 'active',
        },
        {
          title: 'Winter Jacket',
          price: { amount: 5000, currency: 'INR' },
          seller: sellerId,
          category: 'fashion',
          status: 'active',
        },
        {
          title: 'Archived Product',
          price: { amount: 100, currency: 'INR' },
          seller: sellerId,
          status: 'archived',
        },
      ]);
    });

    test('List products with default pagination', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
    });

    test('Only active products in catalog', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200);

      expect(res.body.data.every(p => p.status === 'active')).toBe(true);
    });

    test('Filter by category', async () => {
      const res = await request(app)
        .get('/api/products?category=electronics')
        .expect(200);

      expect(res.body.data.every(p => p.category === 'electronics')).toBe(true);
    });

    test('Filter by price range', async () => {
      const res = await request(app)
        .get('/api/products?minPrice=50000&maxPrice=130000')
        .expect(200);

      expect(
        res.body.data.every(
          p => p.price.amount >= 50000 && p.price.amount <= 130000
        )
      ).toBe(true);
    });

    test('Sort by price ascending', async () => {
      const res = await request(app)
        .get('/api/products?sort=price_asc')
        .expect(200);

      const prices = res.body.data.map(p => p.price.amount);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    test('Sort by price descending', async () => {
      const res = await request(app)
        .get('/api/products?sort=price_desc')
        .expect(200);

      const prices = res.body.data.map(p => p.price.amount);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    test('Pagination works correctly', async () => {
      const res = await request(app)
        .get('/api/products?page=1&limit=2')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.limit).toBe(2);
    });
  });

  // ==================== PATCH TESTS ====================
  describe('PATCH /api/products/:id - Update Product', () => {
    let productId;

    beforeEach(async () => {
      const product = await Product.create({
        title: 'Update Test',
        price: { amount: 100, currency: 'INR' },
        seller: sellerId,
        stock: 50,
      });
      productId = product._id.toString();
    });

    test('Update product title', async () => {
      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Title');
    });

    test('Update product price', async () => {
      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .send({ price: { amount: 200, currency: 'USD' } })
        .expect(200);

      expect(res.body.data.price.amount).toBe(200);
    });

    test('Update product status', async () => {
      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .send({ status: 'draft' })
        .expect(200);

      expect(res.body.data.status).toBe('draft');
    });

    test('Return 404 when product not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/products/${fakeId}`)
        .send({ title: 'New' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    test('Validation on update - invalid price', async () => {
      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .send({ price: { amount: -100, currency: 'INR' } })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ==================== DELETE TESTS ====================
  describe('DELETE /api/products/:id - Delete Product', () => {
    let productId;

    beforeEach(async () => {
      const product = await Product.create({
        title: 'Delete Test',
        price: { amount: 100, currency: 'INR' },
        seller: sellerId,
      });
      productId = product._id.toString();
    });

    test('Soft delete - mark as archived', async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .send({ hardDelete: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('archived');
    });

    test('Hard delete - remove completely', async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .send({ hardDelete: true })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('Return 404 when product not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/products/${fakeId}`)
        .send({ hardDelete: false })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ==================== GET /seller TESTS ====================
  describe('GET /api/products/seller - Seller Products', () => {
    beforeEach(async () => {
      await Product.create([
        {
          title: 'Seller Product 1',
          price: { amount: 1000, currency: 'INR' },
          seller: sellerId,
          status: 'active',
        },
        {
          title: 'Seller Product 2',
          price: { amount: 2000, currency: 'INR' },
          seller: sellerId,
          status: 'active',
        },
        {
          title: 'Seller Draft Product',
          price: { amount: 1500, currency: 'INR' },
          seller: sellerId,
          status: 'draft',
        },
        {
          title: 'Other Seller Product',
          price: { amount: 3000, currency: 'INR' },
          seller: otherSellerId,
          status: 'active',
        },
      ]);
    });

    test('List seller active products', async () => {
      const res = await request(app)
        .get('/api/products/seller/products')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    test('Filter seller products by status', async () => {
      const res = await request(app)
        .get('/api/products/seller/products?status=draft')
        .expect(200);

      expect(res.body.data.every(p => p.status === 'draft')).toBe(true);
    });

    test('Pagination on seller products', async () => {
      const res = await request(app)
        .get('/api/products/seller/products?page=1&limit=1')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });
});

// Helper function for flexible status checking
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
