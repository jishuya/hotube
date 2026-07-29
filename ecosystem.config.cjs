module.exports = {
  apps: [
    {
      name: "hotube-backend",
      cwd: "/home/jishu/workspace/lab/hotube/backend",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "500M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 5001,
      },
    },
  ],
};
