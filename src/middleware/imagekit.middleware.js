const ImageKit = require('@imagekit/nodejs');

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
});

const uploadImageToImageKit = async (file) => {
  try {
    const response = await imagekit.upload({
      file: file.buffer,
      fileName: file.originalname || `image-${Date.now()}`,
      folder: '/ai-marketplace/products/',
      tags: ['product-image'],
    });

    return {
      url: response.url,
      thumbnailUrl: response.thumbnailUrl,
      id: response.fileId,
    };
  } catch (error) {
    const err = new Error(`ImageKit upload failed: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }
};

module.exports = {
  imagekit,
  uploadImageToImageKit,
};
