window.rcmail?.addEventListener('init', function () {
  document.addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target;
    const tag = target?.tagName?.toLowerCase();
    if (target?.isContentEditable || ['input', 'textarea', 'select'].includes(tag)) return;
    if (rcmail.env.task !== 'mail' || rcmail.env.action === 'compose') return;

    const commands = {
      j: 'nextmessage',
      k: 'previousmessage',
      r: 'reply',
    };
    const command = commands[event.key.toLowerCase()];
    if (!command || !rcmail.commands[command]) return;

    event.preventDefault();
    rcmail.command(command);
  });
});
