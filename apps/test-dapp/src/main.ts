import { renderConnect } from './pages/connect.js';
import { renderTransfer } from './pages/transfer.js';
import { renderCallContract } from './pages/call-contract.js';
import { renderSignMessage } from './pages/sign-message.js';
import { renderSignStructured } from './pages/sign-structured.js';
import { renderSignTransaction } from './pages/sign-transaction.js';

const app = document.getElementById('app')!;

const routes: Record<string, (el: HTMLElement) => void> = {
  connect: renderConnect,
  transfer: renderTransfer,
  'call-contract': renderCallContract,
  'sign-message': renderSignMessage,
  'sign-structured': renderSignStructured,
  'sign-transaction': renderSignTransaction,
};

function navigate() {
  const hash = location.hash.slice(1) || 'connect';
  app.innerHTML = '';

  // Update active nav link
  document.querySelectorAll('nav a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === `#${hash}`);
  });

  const render = routes[hash];
  if (render) {
    render(app);
  } else {
    app.innerHTML = '<p>Page not found</p>';
  }
}

window.addEventListener('hashchange', navigate);
navigate();
