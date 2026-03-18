/**
 * Simple in-memory cache for products
 * In production, use Redis
 */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cacheKeys = {
  productId: (id) => `product:${id}`,
  sellerProducts: (sellerId) => `seller:${sellerId}:products`,
  catalog: (query) => `catalog:${JSON.stringify(query)}`,
};

/**
 * Get cached value
 */
const get = (key) => {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiry) {
    cache.delete(key);
    return null;
  }

  return cached.value;
};

/**
 * Set cached value
 */
const set = (key, value, ttl = CACHE_TTL) => {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl,
  });
};

/**
 * Invalidate product cache
 */
const invalidateProduct = (productId) => {
  cache.delete(cacheKeys.productId(productId));
};

/**
 * Invalidate seller products cache
 */
const invalidateSellerProducts = (sellerId) => {
  cache.delete(cacheKeys.sellerProducts(sellerId));
};

/**
 * Clear catalog cache (for all queries)
 */
const invalidateCatalog = () => {
  for (let [key] of cache) {
    if (key.startsWith('catalog:')) {
      cache.delete(key);
    }
  }
};

/**
 * Clear all cache
 */
const clearAll = () => {
  cache.clear();
};

module.exports = {
  get,
  set,
  invalidateProduct,
  invalidateSellerProducts,
  invalidateCatalog,
  clearAll,
  cacheKeys,
};
