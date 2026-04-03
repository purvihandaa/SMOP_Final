import app from './app';
import { config } from './config';
import prisma from './config/database';

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Start HTTP server
    app.listen(config.port, () => {
      console.log(`🚀 SMOP Backend running on port ${config.port}`);
      console.log(`📍 Environment: ${config.env}`);
      console.log(`🔗 API: http://localhost:${config.port}/api`);
      console.log(`❤️  Health: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main();
