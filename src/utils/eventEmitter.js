const EventEmitter = require('events');

const productEvents = new EventEmitter();

// Set max listeners to avoid warnings
productEvents.setMaxListeners(20);

/**
 * Emit product created event
 */
const emitProductCreated = (product) => {
  productEvents.emit('product.created', {
    productId: product._id,
    sellerId: product.seller,
    category: product.category,
    title: product.title,
    timestamp: new Date(),
  });
};

/**
 * Emit product updated event
 */
const emitProductUpdated = (productId, changes) => {
  productEvents.emit('product.updated', {
    productId,
    changes,
    timestamp: new Date(),
  });
};

/**
 * Emit product deleted event
 */
const emitProductDeleted = (productId, sellerId, type = 'soft') => {
  productEvents.emit('product.deleted', {
    productId,
    sellerId,
    deleteType: type,
    timestamp: new Date(),
  });
};

module.exports = {
  productEvents,
  emitProductCreated,
  emitProductUpdated,
  emitProductDeleted,
};
