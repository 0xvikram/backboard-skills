// Harness: renders recipes.md #5's App (which brings its own Dynamic + wagmi providers).
import { createRoot } from 'react-dom/client';
import App from './WagmiApp';

createRoot(document.getElementById('root')!).render(<App />);
