import fs from "node:fs/promises";
import path from "node:path";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { updateSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "setmenuimage",
  aliases: ["setmenupp", "setbotpp"],
  category: "OWNER",
  description: "Set custom image used in .menu and bot responses by replying to an image",
  usage: ".setmenuimage (reply to an image)",
  ownerOnly: true,
  async execute({ sock, message, reply }) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = message.message?.imageMessage || quoted?.imageMessage;

    if (!imageMsg) {
      await reply(formatError("Please reply to an image or attach an image with .setmenuimage."));
      return;
    }

    try {
      const container = message.message?.imageMessage ? message : { message: quoted };
      const buffer = await downloadMediaMessage(container, "buffer", {}, { reconnect: async () => sock });

      const imgPath = path.resolve("./assets/custom-menu.jpg");
      await fs.mkdir(path.dirname(imgPath), { recursive: true });
      await fs.writeFile(imgPath, buffer);

      updateSettings({ menuImage: imgPath, botImage: imgPath });
      await reply(formatSuccess("Bot & menu image updated successfully!"));
    } catch (err) {
      await reply(formatError(`Failed to save image: ${err.message}`));
    }
  }
};
