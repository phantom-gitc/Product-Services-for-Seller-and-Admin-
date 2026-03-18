const Product = require('../models/product.model');
const { uploadImageToImageKit } = require('../middleware/imagekit.middleware');
const cache = require('../utils/cache');
const {
  emitProductCreated,
  emitProductUpdated,
  emitProductDeleted,
} = require('../utils/eventEmitter');

/**
 * POST /api/products/
 * Create a new product with images
 * Only accessible by sellers
 */
const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      seller,
      category,
      stock,
      tags,
      variants,
    } = req.body;
    const files = req.files || [];

    // Upload images to ImageKit if provided
    let uploadedImages = [];
    if (files.length > 0) {
      const imageUploadPromises = files.map((file) =>
        uploadImageToImageKit(file)
      );
      uploadedImages = await Promise.all(imageUploadPromises);
    }

    // If no variants provided, create a base variant
    let variantData = variants;
    if (!variantData || variantData.length === 0) {
      variantData = [
        {
          name: 'Default',
          sku: `${title.substring(0, 3).toUpperCase()}-${Date.now()}`,
          price: price.amount,
          stock: stock || 0,
        },
      ];
    }

    // Create product document
    const productData = {
      title: title.trim(),
      description: description?.trim() || '',
      price: {
        amount: price.amount,
        currency: price.currency || 'INR',
      },
      seller,
      category: category || 'other',
      stock: stock || 0,
      images: uploadedImages,
      variants: variantData,
      tags: tags || [],
      status: 'active',
    };

    const product = new Product(productData);
    await product.save();

    // Emit event
    emitProductCreated(product);

    // Invalidate caches
    cache.invalidateCatalog();
    cache.invalidateSellerProducts(seller);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    console.error('Error creating product:', error);

    if (error.statusCode === 400 || error.statusCode === 500) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error while creating product',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/products/:id
 * Get a single product by ID
 * Cacheable by product ID
 */
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check cache first
    const cacheKey = cache.cacheKeys.productId(id);
    let product = cache.get(cacheKey);

    if (!product) {
      product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      // Cache the product
      cache.set(cacheKey, product);
    }

    return res.status(200).json({
      success: true,
      data: product,
      cached: !!cache.get(cacheKey),
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching product',
    });
  }
};

/**
 * GET /api/products
 * Catalog listing with search, filters, pagination, sort
 */
const getCatalog = async (req, res) => {
  try {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sort = 'newest',
    } = req.query;

    // Build query
    const query = {};

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query['price.amount'] = {};
      if (minPrice) query['price.amount'].$gte = parseFloat(minPrice);
      if (maxPrice) query['price.amount'].$lte = parseFloat(maxPrice);
    }

    // Only active products in catalog
    query.status = 'active';

    // Pagination
    const skip = (page - 1) * limit;

    // Sorting
    let sortObj = { createdAt: -1 }; // default: newest
    if (sort === 'price_asc') sortObj = { 'price.amount': 1 };
    if (sort === 'price_desc') sortObj = { 'price.amount': -1 };
    if (sort === 'rating') sortObj = { 'rating.average': -1 };

    // Get from cache if no search
    const cacheKey = cache.cacheKeys.catalog({
      q,
      category,
      minPrice,
      maxPrice,
      page,
      limit,
      sort,
    });

    let data = cache.get(cacheKey);

    if (!data) {
      const products = await Product.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .sort(sortObj)
        .exec();

      const total = await Product.countDocuments(query);

      data = {
        products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      };

      cache.set(cacheKey, data);
    }
    
    return res.status(200).json({
      success: true,
      data: data.products,
      pagination: data.pagination,
    });
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching catalog',
    });
  }
};

/**
 * PATCH /api/products/:id
 * Update product fields
 * Only seller who created product can update
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { seller } = req; // From auth middleware
    const updateData = req.body;

    // Verify ownership
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    if (product.seller.toString() !== seller) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: only seller can update',
      });
    }

    // Track changes
    const changes = {};
    const allowedFields = [
      'title',
      'description',
      'price',
      'category',
      'stock',
      'tags',
      'status',
    ];

    for (const field of allowedFields) {
      if (field in updateData) {
        changes[field] = updateData[field];
      }
    }

    // Update product
    const updated = await Product.findByIdAndUpdate(id, changes, {
      new: true,
      runValidators: true,
    });

    // Emit event
    emitProductUpdated(id, changes);

    // Invalidate caches
    cache.invalidateProduct(id);
    cache.invalidateCatalog();
    cache.invalidateSellerProducts(seller);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while updating product',
    });
  }
};

/**
 * DELETE /api/products/:id
 * Soft delete (status=archived) or hard delete if no orders
 * Only seller can delete
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { seller } = req; // From auth middleware
    const { hardDelete = false } = req.body;

    // Verify ownership
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    if (product.seller.toString() !== seller) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: only seller can delete',
      });
    }

    let deleted;
    let deleteType = 'soft';

    if (hardDelete) {
      // Hard delete - in production, check if there are any orders first
      // For now, we'll do hard delete directly
      deleted = await Product.findByIdAndDelete(id).exec();
      deleteType = 'hard';
    } else {
      // Soft delete - mark as archived
      deleted = await Product.findByIdAndUpdate(
        id,
        { status: 'archived' },
        { new: true, runValidators: true }
      ).exec();
    }

    // Emit event
    emitProductDeleted(id, seller, deleteType);

    // Invalidate caches
    cache.invalidateProduct(id);
    cache.invalidateCatalog();
    cache.invalidateSellerProducts(seller);

    return res.status(200).json({
      success: true,
      message: `Product ${deleteType} deleted successfully`,
      data: deleted,
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while deleting product',
    });
  }
};

/**
 * GET /api/products/seller
 * Get seller's products
 * Only accessible by the seller
 */
const getSellerProducts = async (req, res) => {
  try {
    const { seller } = req; // From auth middleware
    const {
      page = 1,
      limit = 10,
      status = 'active',
      sort = 'newest',
    } = req.query;

    // Check cache - include all query params in cache key
    const cacheKey = cache.cacheKeys.sellerProducts(seller) + `:${page}:${limit}:${status}:${sort}`;
    let data = cache.get(cacheKey);

    if (!data) {
      const skip = (page - 1) * limit;

      const query = {
        seller,
      };

      if (status) {
        query.status = status;
      }

      let sortObj = { createdAt: -1 };
      if (sort === 'price_asc') sortObj = { 'price.amount': 1 };
      if (sort === 'price_desc') sortObj = { 'price.amount': -1 };

      const products = await Product.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .sort(sortObj)
        .exec();

      const total = await Product.countDocuments(query);

      data = {
        products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      };

      cache.set(cacheKey, data);
    }

    return res.status(200).json({
      success: true,
      data: data.products,
      pagination: data.pagination,
    });
  } catch (error) {
    console.error('Error fetching seller products:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching seller products',
    });
  }
};

/**
 * GET /api/products (alias for getAllProducts - backward compatibility)
 */
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, seller } = req.query;
    const skip = (page - 1) * limit;

    const query = { status: 'active' };
    if (seller) {
      query.seller = seller;
    }

    const products = await Product.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching products',
    });
  }
};

module.exports = {
  createProduct,
  getProduct,
  getCatalog,
  updateProduct,
  deleteProduct,
  getSellerProducts,
  getAllProducts,
};
