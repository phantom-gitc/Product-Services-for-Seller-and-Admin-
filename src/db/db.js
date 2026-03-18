const mongoose = require('mongoose');


async function connectDB() {

    try {

        await mongoose.connect(process.env.MONGODB_URI)
        console.log("MongoDB Connected Sucessfuly 🩵");
        
        
    } catch (error) {

        console.log("MongoDB Connection error " , error);
        
        
    }
    
}


module.exports = connectDB;