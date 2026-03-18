# Jest Test Setup Guide

## Overview
This project uses Jest with Supertest for testing the Express API, particularly the POST /api/products/ endpoint. The tests include mocks for Multer (file uploads) and ImageKit (image handling).

## Prerequisites
Ensure all dependencies are installed:
```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (useful during development)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

## Test Structure

### Test File Location
- `__tests__/product.test.js` - Main test suite for POST /api/products/ endpoint

### Test Coverage
The test suite covers:

1. **Successful Product Creation** - Creating a product with valid data and images
2. **Missing Required Fields** - Returns 400 status when title or seller is missing
3. **Invalid Price Currency** - Validates currency is USD or INR
4. **ImageKit Upload Errors** - Graceful error handling for image upload failures
5. **Invalid Seller ID** - Validates MongoDB ObjectId format
6. **Database Errors** - Handles database connection failures
7. **Multiple Images** - Tests uploading multiple images (up to 5)

## Mocks in Tests

### Multer Mock
- Mocks file upload functionality
- Simulates image file attachments
- Returns fake image data for testing

### ImageKit Mock
- Mocks image upload to ImageKit service
- Returns mock URLs and file IDs
- Allows testing error scenarios

### Product Model Mock
- Mocks MongoDB operations
- Enables isolated testing without database

## Environment Variables

### For Testing
Copy `.env.test` and customize as needed:
```bash
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=your_endpoint
MONGODB_URI=mongodb://localhost:27017/product_test
```

### Before Running Tests
Make sure to set these environment variables or use `.env.test` file.

## Endpoint Specification

### POST /api/products/
**Purpose:** Create a new product with optional image uploads

**Request Body:**
```json
{
  "title": "Product Title",
  "description": "Product description",
  "price": {
    "amount": 99.99,
    "currency": "INR"
  },
  "seller": "507f1f77bcf86cd799439012"
}
```

**File Upload:**
- Field name: `images`
- Accepted types: Image files only
- Max size: 5MB per file
- Max files: 5

**Response (Success - 201):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Product Title",
  "description": "Product description",
  "price": {
    "amount": 99.99,
    "currency": "INR"
  },
  "seller": "507f1f77bcf86cd799439012",
  "images": [
    {
      "url": "https://ik.imagekit.io/...",
      "thumbnailUrl": "https://ik.imagekit.io/...",
      "id": "imagekit-id-123"
    }
  ]
}
```

**Validation Rules:**
- `title` (required): String
- `seller` (required): Valid MongoDB ObjectId
- `price.amount` (required): Number
- `price.currency` (optional): "USD" or "INR" (default: "INR")
- `images` (optional): Image files up to 5MB each, max 5 files

## Debugging Tests

### Verbose Output
Jest is configured to show detailed logs:
```bash
npm test -- --verbose
```

### Run Specific Test
```bash
npm test -- product.test.js
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Common Issues

### Issue: Tests timeout
**Solution:** Increase Jest timeout in jest.config.js
```javascript
testTimeout: 10000, // 10 seconds
```

### Issue: ImageKit mock not working
**Solution:** Ensure jest.mock('@imagekit/nodejs') is at the top of the test file

### Issue: Multer not capturing files
**Solution:** Check the test sends files with correct field name ('images')

## Adding More Tests

When adding new tests:

1. Use `describe()` for grouping related tests
2. Use `beforeEach()` to reset mocks
3. Use clear test names following: "Should [expected behavior] [when condition]"
4. Mock external dependencies (Database, APIs)
5. Test both success and error paths

Example:
```javascript
test('Should create product when valid data provided', async () => {
  // Arrange
  const mockData = { /* ... */ };
  Product.create.mockResolvedValueOnce(mockData);

  // Act
  const response = await request(app)
    .post('/api/products')
    .send(productData);

  // Assert
  expect(response.status).toBe(201);
  expect(response.body.title).toBe(productData.title);
});
```

## CI/CD Integration

To integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: npm test -- --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Multer Documentation](https://github.com/expressjs/multer)
- [ImageKit NodeJS SDK](https://github.com/imagekit-developer/imagekit-nodejs)
