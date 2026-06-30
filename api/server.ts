/**
 * local server entry file, for local development
 */
import app from './app.js';
import initDB from './database/init.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

let server: ReturnType<typeof app.listen>;

// 先初始化数据库，再启动服务器
initDB()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Server ready on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database, starting server anyway:', err);
    // 即使数据库初始化失败也启动服务器，但注册等操作会报错
    server = app.listen(PORT, () => {
      console.log(`Server ready on port ${PORT} (WARNING: database not initialized)`);
    });
  });

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app;