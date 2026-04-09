// server/config/db.js
import mongoose from 'mongoose';

/**
 * Establishes a secure connection to the MongoDB cluster.
 * Uses environment variables to prevent hardcoding sensitive URIs.
 */
const connectDB = async () => {
  try {
    // We use process.env to keep our credentials secure (Security Best Practice)
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    // Exit the process with a failure code if the database cannot connect
    process.exit(1); 
  }
};

export default connectDB;