'use client';
// Harness: renders every recipe component from the skill (copied into _blocks/ by build-app.mjs).
import {EmailLogin} from './_blocks/email';
import {GoogleLogin} from './_blocks/google';
import {SendToken} from './_blocks/send-token';
import {SendWithViem} from './_blocks/viem';
import {Counter} from './_blocks/counter';
import {CallApi} from './_blocks/call-api';
import {WorldLogin} from './_blocks/world';

const ONE = '0x0000000000000000000000000000000000000001';

export default function Recipes() {
  return (
    <div>
      <EmailLogin />
      <GoogleLogin />
      <SendToken token={ONE} to={ONE} />
      <SendWithViem />
      <Counter address={ONE} />
      <CallApi />
      <WorldLogin />
    </div>
  );
}
