const { 
  Client, GatewayIntentBits, EmbedBuilder, REST, Routes, 
  SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, 
  TextInputBuilder, TextInputStyle, AuditLogEvent, AttachmentBuilder 
} = require("discord.js");

const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection } = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates 
  ]
});

const BAN_ROLE_ID = "1516616022352859278"; 
const SUGGESTION_HUB_CHANNEL_ID = "1516999923470565516"; 
const ADMIN_LOG_CHANNEL_ID = "1515161056975126705"; 
const REPORT_LOG_CHANNEL_ID = "1515161056975126705"; 
const BRAND_COLOR = "#FF750D"; 
const BAN_TRACKER = new Set(); 
const REPORT_COOLDOWN = new Map(); 

const EXCLUDED_BOT_1_ID = "678344927997853742"; 
const EXCLUDED_BOT_2_ID = "1516839005314875482"; 

const commands = [
  new SlashCommandBuilder().setName("setup-suggestion").setDescription("Deploy the suggestion panel."),
  new SlashCommandBuilder().setName("play-live").setDescription("Start Aljazeera live stream."),
  new ContextMenuCommandBuilder().setName("🚨 REPORT TO YONKO").setType(ApplicationCommandType.User)
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`[SYSTEM ONLINE] ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("[PROTOCOL] Commands Synchronized.");
  } catch (error) { console.error(error); }
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const connection = getVoiceConnection(oldState.guild.id);
  if (!connection) return;
  const channel = oldState.guild.channels.cache.get(connection.joinConfig.channelId);
  if (channel && channel.members.size === 1) { connection.destroy(); }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!oldMember.roles.cache.has(BAN_ROLE_ID) && newMember.roles.cache.has(BAN_ROLE_ID)) {
    BAN_TRACKER.add(newMember.id); 
    setTimeout(async () => {
      try {
        const member = await newMember.guild.members.fetch(newMember.id).catch(() => null);
        if (member && member.roles.cache.has(BAN_ROLE_ID)) {
          const finalBanEmbed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("🔨 Congratulations").setDescription("Your mute has been removed.\n\n🚫 **Permanently Banned.**\nWa 3awd sb lah wla di almoul7id 🧏🏻‍♂️.").setTimestamp();
          await member.send({ embeds: [finalBanEmbed] }).catch(() => {});
          await member.ban({ reason: "Security Enforcement." });
          BAN_TRACKER.delete(newMember.id);
        }
      } catch (err) { console.error(err); }
    }, 30000);
  }
});

client.on("interactionCreate", async (interaction) => {
  // أمر البث (مخصص للأدمن فقط)
  if (interaction.isChatInputCommand() && interaction.commandName === "play-live") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ هذا الأمر مخصص للأدمن فقط.", ephemeral: true });
    }
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply({ content: "يجب أن تكون في قناة صوتية!", ephemeral: true });
    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    const player = createAudioPlayer();
    const resource = createAudioResource("https://www.youtube.com/live/bNyUyrR0PHo?si=YM9Guuo5BLYeAq9f");
    connection.subscribe(player);
    player.play(resource);
    return interaction.reply({ content: "🔊 تم تشغيل بث الجزيرة.", ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "setup-suggestion") {
    if (!interaction.member.permissions.has("Administrator")) return interaction.reply({ content: "❌ No permission.", ephemeral: true });
    const hubChannel = interaction.guild.channels.cache.get(SUGGESTION_HUB_CHANNEL_ID);
    if (!hubChannel) return interaction.reply({ content: "Error: Not found.", ephemeral: true });
    const panelEmbed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("🔱 ─── SERVER SUGGESTION HUB ─── 🔱").setDescription("Click below to submit.").setTimestamp();
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("open_suggestion_modal").setLabel("Submit").setStyle(ButtonStyle.Primary).setEmoji("💡"));
    await interaction.reply({ content: "✅ Panel deployed.", ephemeral: true });
    return hubChannel.send({ embeds: [panelEmbed], components: [row] });
  }
  if (interaction.isButton() && interaction.customId === "open_suggestion_modal") {
    const modal = new ModalBuilder().setCustomId("suggestion_modal").setTitle("Submit Suggestion");
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("suggestion_input").setLabel("What is your suggestion?").setStyle(TextInputStyle.Paragraph).setRequired(true)));
    return interaction.showModal(modal);
  }
  if (interaction.isModalSubmit() && interaction.customId === "suggestion_modal") {
    const suggestionText = interaction.fields.getTextInputValue("suggestion_input");
    const adminChannel = interaction.guild.channels.cache.get(ADMIN_LOG_CHANNEL_ID);
    if (!adminChannel) return interaction.reply({ content: "Error: Log channel not found.", ephemeral: true });
    const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("🔱 SUGGESTION 🔱").setDescription(`\`\`\`${suggestionText}\`\`\``).setTimestamp();
    await adminChannel.send({ embeds: [embed] });
    return interaction.reply({ content: "✅ Sent.", ephemeral: true });
  }
});

client.on("guildBanAdd", async (ban) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  try {
    const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildBanAdd }).catch(() => null);
    if (!fetchedLogs) return;
    const banLog = fetchedLogs.entries.first();
    if (!banLog || banLog.executor.id === EXCLUDED_BOT_1_ID || banLog.executor.id === EXCLUDED_BOT_2_ID) return;
    const file = new AttachmentBuilder("./590606.jpg");
    await ban.user.send({ embeds: [new EmbedBuilder().setTitle("🎮 WASTED").setImage("attachment://590606.jpg")], files: [file] }).catch(() => {});
  } catch (error) { console.error(error); }
});

client.login(process.env.TOKEN);
  
