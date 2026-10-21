#!/usr/bin/env node

/**
 * Hermes Agent Interactive CLI (Nous Research style)
 * Interfaz interactiva de consola para programadores
 */

import readline from 'readline';

const API_URL = process.env.HERMES_API_URL || 'http://localhost:3200/v1/chat/completions';
const MODEL = process.env.HERMES_MODEL || 'google/gemini-2.5-flash';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\x1b[36mhermes>\x1b[0m '
});

const messages = [];

console.clear();
console.log('\x1b[35m' + '='.repeat(60) + '\x1b[0m');
console.log('\x1b[1m\x1b[32m  🏛️  HERMES AGENT CLI (Developer Interactive Console)\x1b[0m');
console.log('\x1b[34m  Nous Research & OpenRouter Engine Active\x1b[0m');
console.log('\x1b[33m  Comandos: /clear, /status, /model, /exit\x1b[0m');
console.log('\x1b[35m' + '='.repeat(60) + '\x1b[0m\n');

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }

  if (input === '/exit' || input === 'exit' || input === 'quit') {
    console.log('\x1b[33mCerrando sesión de Hermes Agent. ¡Hasta luego!\x1b[0m');
    process.exit(0);
  }

  if (input === '/clear') {
    messages.length = 0;
    console.clear();
    console.log('\x1b[32mHistorial de conversación reiniciado.\x1b[0m');
    rl.prompt();
    return;
  }

  if (input === '/status') {
    console.log(`\x1b[34m[Hermes CLI] Modelo: ${MODEL} | Endpoint: ${API_URL}\x1b[0m`);
    rl.prompt();
    return;
  }

  messages.push({ role: 'user', content: input });
  process.stdout.write('\x1b[33mHermes está pensando...\x1b[0m\r');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages
      })
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || data.error || 'Sin respuesta';

    messages.push({ role: 'assistant', content: reply });

    console.log('\x1b[2K\r\x1b[1m\x1b[35m🤖 Hermes:\x1b[0m\n' + reply + '\n');
  } catch (err) {
    console.log(`\x1b[2K\r\x1b[31mError al conectar con Hermes Agent: ${err.message}\x1b[0m\n`);
  }

  rl.prompt();
}).on('close', () => {
  console.log('\nSesión terminada.');
  process.exit(0);
});
