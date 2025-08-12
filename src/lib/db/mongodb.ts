import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gamehub'

let isConnected = false

async function dbConnect() {
  if (isConnected) {
    return
  }

  try {
    await mongoose.connect(MONGODB_URI)
    isConnected = true
    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    throw error
  }
}

export default dbConnect 