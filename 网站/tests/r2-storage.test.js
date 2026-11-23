import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { createR2Driver, signAwsV4 } from '../src/storage/r2.js';

const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';


test('AWS Signature V4 matches the official GET example', () => {
  const result = signAwsV4({
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: { Range: 'bytes=0-9' },
    payloadHash: EMPTY_SHA256,
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    service: 's3',
    timestamp: new Date('2013-05-24T00:00:00.000Z'),
  });

  assert.equal(
    result.signature,
    'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'
  );
  assert.equal(result.amzDate, '20130524T000000Z');
});


test('R2 public URLs encode object keys and use the configured domain', () => {
  const driver = createR2Driver({
    accountId: 'account',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    bucket: 'couple-assets',
    publicBaseUrl: 'https://assets.example.com/base/',
  });

  assert.equal(
    driver.url('photos/our photo.jpg'),
    'https://assets.example.com/base/photos/our%20photo.jpg'
  );
});


test('R2 without a public domain returns protected media proxy URLs', () => {
  const driver = createR2Driver({
    accountId: 'account',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    bucket: 'couple-assets',
    publicBaseUrl: '',
  });

  assert.equal(driver.url('photos/our photo.jpg'), '/media/photos/our%20photo.jpg');
});


test('R2 upload signs a PUT request against the bucket endpoint', async () => {
  const calls = [];
  const driver = createR2Driver({
    accountId: 'abc123',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    bucket: 'couple-assets',
    publicBaseUrl: 'https://assets.example.com',
    now: () => new Date('2026-11-18T00:00:00.000Z'),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('', { status: 200 });
    },
  });

  const result = await driver.put('photos/test.jpg', Buffer.from('abc'), 'image/jpeg');
  assert.equal(result, 'https://assets.example.com/photos/test.jpg');
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://abc123.r2.cloudflarestorage.com/couple-assets/photos/test.jpg'
  );
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers['Content-Type'], 'image/jpeg');
  assert.equal(calls[0].options.headers['content-type'], undefined);
  assert.equal(
    calls[0].options.headers['x-amz-content-sha256'],
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  assert.match(calls[0].options.headers.Authorization, /^AWS4-HMAC-SHA256 /);
  assert.match(calls[0].options.headers.Authorization, /\/auto\/s3\/aws4_request/);
});


test('R2 private reads use a signed GET through the app proxy', async () => {
  const calls = [];
  const driver = createR2Driver({
    accountId: 'abc123',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    bucket: 'love',
    publicBaseUrl: '',
    now: () => new Date('2026-11-18T00:00:00.000Z'),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(Buffer.from('image-bytes'), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    },
  });

  const result = await driver.get('photos/test.jpg', 'bytes=0-10');
  assert.equal(result.body.toString(), 'image-bytes');
  assert.equal(result.contentType, 'image/jpeg');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.Range, 'bytes=0-10');
  assert.match(calls[0].options.headers.Authorization, /^AWS4-HMAC-SHA256 /);
});


test('complete R2 variables automatically select the R2 driver', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      'import config from "./src/config.js"; console.log(config.storageDriver)',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        STORAGE_DRIVER: '',
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'access',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
      },
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'r2');
});
