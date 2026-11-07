import { existsSync, readFileSync } from "node:fs";
import { runCli } from "./run";

process.exitCode = runCli(process.argv.slice(2), {
  readFile: (path) => new Uint8Array(readFileSync(path)),
  fileExists: (path) => existsSync(path),
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});
