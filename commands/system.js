import os from "node:os";
import { formatResponse } from "../lib/format.js";

export const command = {
  name: "system",
  aliases: ["sys", "host"],
  category: "SYSTEM",
  description: "Display host system resource statistics",
  usage: ".system",
  async execute({ reply }) {
    const memory = process.memoryUsage();
    const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
    const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
    const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
    const uptime = Math.floor(process.uptime());

    const body = `Node.js: ${process.version}
Platform: ${os.platform()} (${os.release()})
Architecture: ${os.arch()}
CPUs: ${os.cpus().length} core(s)
Heap Usage: ${heapUsedMB} MB
System Memory: ${totalMemMB - freeMemMB} / ${totalMemMB} MB
Process Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;

    await reply(formatResponse(body, "SYSTEM"));
  }
};
