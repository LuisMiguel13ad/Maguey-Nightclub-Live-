// Import commands
import './commands/auth';
import './commands/purchase';
import './commands/scan';
import './commands/db';

// Import Stripe plugin
import 'cypress-plugin-stripe-elements';

// Hide fetch/XHR logs in command log (less noise)
const app = window.top;
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style');
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }';
  style.setAttribute('data-hide-command-log-request', '');
  app.document.head.appendChild(style);
}
