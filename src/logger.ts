import fs from "fs";
import path from "path";

const COLORS = {
  CLEAR: "\x1b[0m", // Clear
  DEBUG: "\x1b[36m", // Cyan
  INFO: "\x1b[37m", // White
  ERROR: "\x1b[31m", // Red
  SUCCESS: "\x1b[32m", // Green
  WARN: "\x1b[33m", // Yellow
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

  return [
    `${min.toString().padStart(3, "0")}m`,
    `${sec.toString().padStart(2, "0")}s`,
    `${ms.toString().padStart(3, "0")}ms`,
  ].join(" ");
};

function log(level: keyof typeof COLORS, ...msgs: any[]) {
  try {
    const formattedMsg = msgs
      .map((m) => (typeof m === "object" ? JSON.stringify(m, null, 2) : m))
      .join(" ");
    logStream.write(`${level} ${formattedMsg}\n`);
  } catch (error) {}

  const color = COLORS[level];

  let _msgs = msgs.flatMap((msg) =>
    (typeof msg === "object" && msg !== null) || Array.isArray(msg)
      ? [COLORS.CLEAR, msg, color]
      : String(msg)
  );

  console.log(
    `${color}${level.padEnd(7, " ")} ${getElapsed()}`,
    ..._msgs,
    COLORS.CLEAR
  );
}

export const debug = (...msg: any) => log("DEBUG", ...msg);
export const error = (...msg: any) => log("ERROR", ...msg);
export const info = (...msg: any) => log("INFO", ...msg);
export const success = (...msg: any) => log("SUCCESS", ...msg);
export const warn = (...msg: any) => log("WARN", ...msg);
