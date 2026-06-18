const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require("discord.js");
const axios = require('axios');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// هذا هو الجزء الذي يمنع ظهور "The application did not respond"
client.on("interactionCreate", async (interaction) => {
    // إذا كان التفاعل زر أو مودال، نخبر ديسكورد فوراً أننا استلمنا الطلب
    if (interaction.isButton() || interaction.isModalSubmit()) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    // هنا تضع منطق الأزرار الخاص بك (مثلاً زر Restore Access)
    if (interaction.isButton() && interaction.customId === "restore_access") {
        // يمكنك إرسال رد هنا
        await interaction.editReply({ content: "Access restoration process initiated..." });
    }
});

client.once("ready", () => {
    console.log(`[SYSTEM] YONKO Bot is online!`);
});

// تأكد من وضع التوكين في Variables داخل لوحة Railway
client.login(process.env.TOKEN);
