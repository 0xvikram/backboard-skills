// errors.md #6: with bundler resolution the SDK's own types load, so these misuses are type errors and `e` is typed.
import { OnrampWebSDK } from '@onramp.money/onramp-web-sdk';
const s = new OnrampWebSDK({ appId: 2, containerId: '#x' });
s.on('TX_EVENTS', (e) => { const t: string = e.type; void t; });
// @ts-expect-error containerId must be a '#...' string
new OnrampWebSDK({ appId: 2, containerId: 'x' });
// @ts-expect-error appId is required
new OnrampWebSDK({ flowType: 1 });
