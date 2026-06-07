#!/bin/bash
# Render build script for backend deployment
# This script ensures npm install runs in the backend folder where dependencies are defined

echo "🔧 Starting Render build process..."
echo "📂 Installing dependencies from backend folder..."

cd backend
npm install

echo "✅ Build complete - backend dependencies installed"
