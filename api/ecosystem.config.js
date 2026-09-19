// P3.18: PM2 в кластерном режиме — единственный процесс Node.js использовал
// одно ядро из выделенных серверу. Кластер поднимает N копий API за одним
// портом (SO_REUSEPORT балансирует соединения), каждый воркер — отдельный
// event loop со своим пулом Prisma.
//
// Важно для этой кодовой базы:
//  - фоновые задачи (напоминания/просрочка заказов/серии) запускаются только
//    в воркере 0 — см. common/dispatcher.ts;
//  - rate limiting и кэш лидерборда — in-memory на процесс: суммарный лимит
//    запросов и «свежесть» кэша делятся на N воркеров (для кэша это даже
//    точнее, для троттлера — учтено дефолтами);
//  - суммарный пул соединений = N × DATABASE_CONNECTION_LIMIT: держите
//    DATABASE_CONNECTION_LIMIT ≈ 12/N (см. docker-compose.prod.yml).
module.exports = {
  apps: [
    {
      name: 'siberiangym-api',
      cwd: __dirname,
      script: 'dist/main.js',
      exec_mode: 'cluster',
      // Консервативный дефолт под текущий контейнер; масштабируется
      // переменной PM2_INSTANCES без пересборки образа.
      instances: process.env.PM2_INSTANCES || 2,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
    },
  ],
};
