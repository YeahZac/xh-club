/**
 * 粤商汇 - PM2 进程管理配置
 * 使用方式: pm2 start deploy/ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      // 应用名称
      name: 'yueshanghui-api',
      
      // 启动脚本
      script: './server/dist/main.js',
      
      // 工作目录
      cwd: '/var/www/yueshanghui',
      
      // 实例数量 (根据服务器CPU核心数调整)
      // 2核服务器建议: 1-2个实例
      instances: 1,
      
      // 是否启用集群模式
      exec_mode: 'fork',
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/yueshanghui/logs/pm2-error.log',
      out_file: '/var/www/yueshanghui/logs/pm2-out.log',
      merge_logs: true,
      
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // 重启延迟
      restart_delay: 4000,
      
      // 崩溃重启最大次数
      max_restarts: 10,
      min_uptime: '10s',
      
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // 环境变量文件 (可选)
      // env_file: '/var/www/yueshanghui/.env',
      
      // 源码映射
      source_map_support: true,
    },
  ],
};
