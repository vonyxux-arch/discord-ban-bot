const { 
  Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
  ContextMenuCommandBuilder, ApplicationCommandType, ActionRowBuilder, 
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
  TextInputStyle, AuditLogEvent, AttachmentBuilder 
} = require("discord.js");
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration 
  ]
});

// [الإعدادات الثابتة]
const BAN_ROLE_ID = "1516616022352859278"; 
const SUGGESTION_HUB_CHANNEL_ID = "1516999923470565516"; 
const ADMIN_LOG_CHANNEL_ID = "1515161056975126705"; 
const REPORT_LOG_CHANNEL_ID = "1515161056975126705"; 
const BRAND_COLOR = "#FF750D"; 
const BAN_TRACKER = new Set(); 
const REPORT_COOLDOWN = new Map(); 
const EXCLUDED_BOT_1_ID = "678344927997853742"; 
const EXCLUDED_BOT_2_ID = "1516839005314875482"; 

// [نظام الفلترة الموحد]
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || message.attachments.size === 0 || message.embeds.length > 0) return;
  const attachment = message.attachments.first();
  if (!attachment.contentType?.startsWith('image/') && !attachment.contentType?.startsWith('video/')) return;
  try {
    const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
      params: { 'url': attachment.url, 'models': 'nudity-2.0,gore', 'api_user': process.env.SIGHT_USER, 'api_secret': process.env.SIGHT_SECRET }
    });
    if (response.data.nudity.raw > 0.8 || response.data.gore.raw > 0.6) {
      await message.delete().catch(() => null);
      if (message.member?.bannable) {
        await message.member.ban({ reason: "AI Security: Restricted media detected." });
      }
    }
  } catch (e) { console.error(e); }
});

// [نظام البان الموحد - يرسل الرسالة لأي بان يحدث]
client.on("guildBanAdd", async (ban) => {
  await new Promise(r => setTimeout(r, 2000));
  const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildBanAdd }).catch(() => null);
  const entry = logs?.entries.first();
  if (!entry || entry.executor.id === EXCLUDED_BOT_1_ID || entry.executor.id === EXCLUDED_BOT_2_ID) return;
  
  const dmBanEmbed = new EmbedBuilder()
    .setColor(BRAND_COLOR).setTitle("🎮 GAME OVER | WASTED")
    .setDescription(`Well, looks like you either broke one of our strict rules or simply managed to trigger an angry moderator. Either way... you are officially banned from **YONKO Server**.\n\nNext time, try not to test the staff's patience. Good luck out there!`)
    .addFields({ name: "🔨 Banned By", value: `\`${entry.executor.tag}\``, inline: true }, { name: "📝 Reason", value: `\`\`\`fix\n${entry.reason || "Security Enforcement"}\n\`\`\``, inline: false })
    .setImage("attachment://590606.jpg").setTimestamp().setFooter({ text: "YONKO TEAM Server", iconURL: ban.guild.iconURL() });
  
  await ban.user.send({ embeds: [dmBanEmbed], files: [new AttachmentBuilder("./590606.jpg")] }).catch(() => {});
});

// [الأوامر والأنظمة الأخرى كما هي تماماً]
// هنا تضع (client.on("interactionCreate"...)) و (client.on("guildMemberUpdate"...)) وكل الأكواد الأصلية الأخرى.

client.login(process.env.TOKEN);
