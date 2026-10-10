module.exports = {
  apps: [
    {
      name: 'hermes-agent-service',
      script: 'server.js',
      cwd: '/var/www/vhosts/movi.digital/hermes.mainserver.movi.digital',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3200,
        HERMES_MODEL: 'google/gemini-2.5-flash'
      }
    }
  ]
};
