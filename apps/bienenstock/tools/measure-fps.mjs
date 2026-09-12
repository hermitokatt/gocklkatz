// Measure the app's own frame-rate readout in a real browser, over real time.
//
// Why this exists: "renders at 60 fps" is a claim, and a claim needs a measurement behind it. This
// drives a real Chrome over the DevTools protocol, waits real seconds, and reads the figure the app
// itself computed.
//
// Why not `--dump-dom` with `--virtual-time-budget`: that flag does not advance
// `requestAnimationFrame`. The page then reports "measuring fps" forever, and a perfectly good scene
// looks like a broken one. That mistake was made once; this script is the correction.
//
// Usage:
//   node tools/measure-fps.mjs <url> [seconds]
//
// Environment:
//   CHROME_PATH  path to a Chrome or Chromium binary (default: the macOS Chrome location)
//   CHROME_PORT  DevTools port (default 9333)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const url = process.argv[2];
const seconds = Number(process.argv[3] ?? 15);
const port = Number(process.env.CHROME_PORT ?? 9333);

if (!url) {
  console.error("usage: node tools/measure-fps.mjs <url> [seconds]");
  process.exit(2);
}
if (!fs.existsSync(CHROME)) {
  console.error(`no Chrome at ${CHROME}. Set CHROME_PATH to one.`);
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "bienen-chrome-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1280,800",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let socket;
try {
  // The debugger takes a moment to listen, and the port is the only way to find the page target.
  let wsUrl = null;
  for (let attempt = 0; attempt < 60 && wsUrl === null; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      wsUrl = page?.webSocketDebuggerUrl ?? null;
    } catch {
      // Not up yet.
    }
    if (wsUrl === null) await sleep(250);
  }
  if (wsUrl === null) throw new Error("Chrome's debugger never came up");

  socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(
        message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "),
      );
    }
    if (message.method === "Runtime.exceptionThrown") {
      consoleErrors.push(`EXCEPTION: ${message.params.exceptionDetails?.text ?? "unknown"}`);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", () => reject(new Error("debugger socket failed")));
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });

  // Real time, not virtual time. This is the whole point of the script.
  await sleep(seconds * 1000);

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.result?.value;
  };

  const readout = await evaluate(
    `document.querySelector('[data-bienen-readout]')?.textContent ?? null`,
  );
  const renderer = await evaluate(`(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 'no WebGL context';
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'context created, renderer hidden';
    } catch (cause) {
      return 'error: ' + cause.message;
    }
  })()`);

  console.log(JSON.stringify({ url, seconds, readout, renderer, consoleErrors }, null, 2));

  if (readout === null) {
    console.error("the readout element was never found — is this the /bienen route?");
    process.exitCode = 1;
  } else if (consoleErrors.length > 0) {
    console.error("the page logged errors while rendering");
    process.exitCode = 1;
  }
} finally {
  socket?.close();
  chrome.kill("SIGKILL");
  fs.rmSync(profile, { recursive: true, force: true });
}
