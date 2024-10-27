import fs from "fs";
import path from "path";

const COLORS = {
  CLEAR: "\x1b[0m", // Clear
  DEBUG: "\x1b[36m%s", // Cyan
  INFO: "\x1b[37m%s", // White
  ERROR: "\x1b[31m%s", // Red
  SUCCESS: "\x1b[32m%s", // Green
  WARN: "\x1b[33m%s", // Yellow
} as const;

let start = Date.now();
let logPath: string;
let logStream: fs.WriteStream;
export function reset() {
  start = Date.now();

  const dt = new Date();
  const dateStr = `${dt.getMonth() + 1}-${dt.getDate()}`;
  const timeStr = `${dt.getHours().toString().padStart(2, "0")}:${dt
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${dt.getSeconds().toString().padStart(2, "0")}:${dt
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;
  const dtStr = `${dateStr} ${timeStr}`;

  logPath = path.join(__dirname, "../logs", `${dtStr}.txt`);

  if (!fs.existsSync(logPath))
    fs.writeFileSync(logPath, `Log reset time: ${dtStr}\n\n`);

  logStream = fs.createWriteStream(logPath, {});
}

const getElapsed = () => {
  const elapsed = Date.now() - start;
  const min = Math.floor(elapsed / (60 * 1000));
  const sec = Math.floor((elapsed % (60 * 1000)) / 1000);
  const ms = elapsed % 1000;

  return `\
${min.toString().padStart(3, "0")}m \
${sec.toString().padStart(2, "0")}s \
${ms.toString().padStart(3, "0")}ms`;
};

function log(level: keyof typeof COLORS, ...msg: any[]) {
  try {
    logStream.write(`${[level, ...msg].join(" ")}\n`);
  } catch (error) {}

  console.log(
    COLORS[level].padEnd(7, " "),
    `${level.padEnd(7, " ")}`,
    ...msg,
    COLORS.CLEAR
  );
}

export const debug = (...msg: any) => log("DEBUG", getElapsed(), ...msg);
export const error = (...msg: any) => log("ERROR", getElapsed(), ...msg);
export const info = (...msg: any) => log("INFO", getElapsed(), ...msg);
export const success = (...msg: any) => log("SUCCESS", getElapsed(), ...msg);
export const warn = (...msg: any) => log("WARN", getElapsed(), ...msg);
