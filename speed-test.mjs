import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { performance } from 'node:perf_hooks';

const REQUEST_COUNT = 10;
const REQUEST_TIMEOUT_MS = 120_000;

function openResponse(url) {
  const get = url.protocol === 'https:' ? httpsGet : httpGet;

  return new Promise((resolve, reject) => {
    const request = get(url, {
      headers: { 'Accept-Encoding': 'identity' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }, resolve);
    request.once('error', reject);
  });
}

async function measureDownload(url) {
  const start = performance.now();
  const response = await openResponse(url);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    response.destroy();
    throw new Error(`HTTP ${response.statusCode}. Use a direct URL that returns a 2xx response.`);
  }

  let bytes = 0;
  for await (const chunk of response) {
    bytes += chunk.length;
  }

  return { bytes, durationMs: performance.now() - start };
}

async function main(args) {
  if (args.length !== 1 || !URL.canParse(args[0])) {
    throw new Error('Usage: node speed-test.mjs <http-or-https-url>');
  }

  const url = new URL(args[0]);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The URL must start with http:// or https://.');
  }

  let totalBytes = 0;
  let totalDurationMs = 0;

  for (let index = 1; index <= REQUEST_COUNT; index += 1) {
    try {
      const { bytes, durationMs } = await measureDownload(url);
      totalBytes += bytes;
      totalDurationMs += durationMs;
    } catch (error) {
      throw new Error(`Request ${index}/${REQUEST_COUNT} failed: ${error.message}`);
    }
  }

  const averageDurationMs = totalDurationMs / REQUEST_COUNT;
  const speedMbps = (totalBytes * 8) / (totalDurationMs / 1_000) / 1_000_000;

  console.log(`Requests: ${REQUEST_COUNT}`);
  console.log(`Average request time: ${averageDurationMs.toFixed(2)} ms`);
  console.log(`Total downloaded: ${totalBytes} bytes`);
  console.log(`Download speed: ${speedMbps.toFixed(3)} Mbps`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
