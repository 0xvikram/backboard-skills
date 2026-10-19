// Harness: the App rendered by recipes.md #6 main.tsx (custom networks). Renders the recipe components.
import { Header } from './recipes/header';
import { CreateEmbeddedWallet } from './recipes/embedded';
import { SendTransaction } from './recipes/send';
import { SignMessageButton } from './recipes/sign';
import { callMyApi } from './recipes/api';

export default function App() {
  return (
    <div>
      <Header />
      <CreateEmbeddedWallet />
      <SendTransaction />
      <SignMessageButton />
      <button onClick={() => callMyApi().then(console.log)}>Call API</button>
    </div>
  );
}
