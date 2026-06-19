const { 
  Client, GatewayIntentBits, EmbedBuilder, REST, Routes, 
  SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, 
  TextInputBuilder, TextInputStyle, AuditLogEvent, AttachmentBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder 
} = require("discord.js");

const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection } = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildVoiceStates 
  ]
});

// الثوابت (IDs)
const BAN_ROLE_ID = "1516616022352859278"; 
const SUGGESTION_HUB_CHANNEL_ID = "1516999923470565516"; 
const ADMIN_LOG_CHANNEL_ID = "1515161056975126705"; 
const ALLOWED_VOICE_CHANNEL_ID = "1517510114830192711";
const BRAND_COLOR = "#FF750D"; 
const EXCLUDED_BOT_1_ID = "678344927997853742"; 
const EXCLUDED_BOT_2_ID = "1516839005314875482"; 

const channels = {
  "aljazeera": { name: "الجزيرة", url: "https://www.youtube.com/live/bNyUyrR0PHo?si=YM9Guuo5BLYeAq9f" }
};

const commands = [
  new SlashCommandBuilder().setName("play-live").setDescription("Start or manage live streams.").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setup-suggestion").setDescription("Deploy the suggestion panel."),
  new ContextMenuCommandBuilder().setName("🚨 REPORT TO YONKO").setType(ApplicationCommandType.User)
].map(command => command.toJSON());

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log(`[SYSTEM ONLINE] ${client.user.tag}`);
});

// وظيفة خروج البوت التلقائي
client.on("voiceStateUpdate", (oldState, newState) => {
  const connection = getVoiceConnection(oldState.guild.id);
  if (connection) {
    const channel = oldState.guild.channels.cache.get(connection.joinConfig.channelId);
    if (channel && channel.members.size === 1) connection.destroy();
  }
});

// حماية الأعضاء (guildMemberUpdate)
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!oldMember.roles.cache.has(BAN_ROLE_ID) && newMember.roles.cache.has(BAN_ROLE_ID)) {
    setTimeout(async () => {
      const member = await newMember.guild.members.fetch(newMember.id).catch(() => null);
      if (member && member.roles.cache.has(BAN_ROLE_ID)) {
        await member.send({ content: "🚫 Banned." }).catch(() => {});
        await member.ban({ reason: "Security Enforcement." });
      }
    }, 30000);
  }
});

client.on("interactionCreate", async (interaction) => {
  // 1. أمر التشغيل
  if (interaction.isChatInputCommand() && interaction.commandName === "play-live") {
    const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("📺 YONKO LIVE CONTROL 📻").setDescription("استخدم القائمة والأزرار للتحكم.");
    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("select_channel").setPlaceholder("اختر القناة").addOptions(new StringSelectMenuOptionBuilder().setLabel("الجزيرة").setValue("aljazeera")));
    const btns = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("btn_pause").setLabel("Pause").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId("btn_resume").setLabel("Resume").setStyle(ButtonStyle.Success));
    return interaction.reply({ embeds: [embed], components: [row, btns] });
  }

  // 2. التحكم بالبث
  if (interaction.isStringSelectMenu() && interaction.customId === "select_channel") {
    const channel = interaction.guild.channels.cache.get(ALLOWED_VOICE_CHANNEL_ID);
    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    const player = createAudioPlayer();
    player.play(createAudioResource(channels[interaction.values[0]].url));
    connection.subscribe(player);
    return interaction.reply({ content: `🔊 تم تشغيل ${channels[interaction.values[0]].name} في YONKO LIVE 📻`, ephemeral: true });
  }

  if (interaction.isButton()) {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      const player = connection.state.subscription.player;
      if (interaction.customId === "btn_pause") player.pause();
      if (interaction.customId === "btn_resume") player.unpause();
      return interaction.reply({ content: "✅ تم التنفيذ.", ephemeral: true });
    }
  }

  // 3. نظام الاقتراحات
  if (interaction.isChatInputCommand() && interaction.commandName === "setup-suggestion") {
    const hub = interaction.guild.channels.cache.get(SUGGESTION_HUB_CHANNEL_ID);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("open_suggestion_modal").setLabel("Submit").setStyle(ButtonStyle.Primary));
    await hub.send({ embeds: [new EmbedBuilder().setTitle("🔱 SUGGESTION HUB").setDescription("Click below.")], components: [row] });
    return interaction.reply({ content: "✅ Done.", ephemeral: true });
  }
});

// حماية البان
client.on("guildBanAdd", async (ban) => {
  const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildBanAdd }).catch(() => null);
  const banLog = fetchedLogs?.entries.first();
  if (banLog && ![EXCLUDED_BOT_1_ID, EXCLUDED_BOT_2_ID].includes(banLog.executor.id)) {
    const file = new AttachmentBuilder("./590606.jpg");
    await ban.user.send({ files: [file] }).catch(() => {});
  }
});

client.login(process.env.TOKEN);
