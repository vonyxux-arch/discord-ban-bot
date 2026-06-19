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

// الثوابت
const BAN_ROLE_ID = "1516616022352859278"; 
const SUGGESTION_HUB_CHANNEL_ID = "1516999923470565516"; 
const ADMIN_LOG_CHANNEL_ID = "1515161056975126705"; 
const ALLOWED_VOICE_CHANNEL_ID = "1517510114830192711";
const COMMAND_CHANNEL_ID = "1517509312774279238";
const BRAND_COLOR = "#FF750D"; 
const EXCLUDED_BOT_1_ID = "678344927997853742"; 
const EXCLUDED_BOT_2_ID = "1516839005314875482"; 

const streams = {
  "aljazeera": { name: "الجزيرة", url: "https://www.youtube.com/live/bNyUyrR0PHo?si=YM9Guuo5BLYeAq9f" },
  "mecca": { name: "مكة المكرمة", url: "https://www.youtube.com/live/rojlkPMBgpY?si=hPRONW9QECbQMlLK" },
  "beinsports": { name: "بين سبورت نيوز", url: "https://www.youtube.com/live/2lJZPT6OljI?si=oBrj_qtCwpa-h4S5" }
};

let leaveTimeout = null;

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

// دالة عداد الخروج التلقائي
function checkVoiceState(guild) {
  const connection = getVoiceConnection(guild.id);
  if (!connection) return;
  const channel = guild.channels.cache.get(ALLOWED_VOICE_CHANNEL_ID);
  if (channel && channel.members.size <= 1) {
    if (!leaveTimeout) leaveTimeout = setTimeout(() => { connection.destroy(); leaveTimeout = null; }, 300000);
  } else {
    if (leaveTimeout) { clearTimeout(leaveTimeout); leaveTimeout = null; }
  }
}

client.on("voiceStateUpdate", (oldState, newState) => checkVoiceState(newState.guild || oldState.guild));

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!oldMember.roles.cache.has(BAN_ROLE_ID) && newMember.roles.cache.has(BAN_ROLE_ID)) {
    setTimeout(async () => {
      const member = await newMember.guild.members.fetch(newMember.id).catch(() => null);
      if (member && member.roles.cache.has(BAN_ROLE_ID)) {
        await member.send({ content: "🚫 Permanently Banned." }).catch(() => {});
        await member.ban({ reason: "Security Enforcement." });
      }
    }, 30000);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.channelId !== COMMAND_CHANNEL_ID && !interaction.isModalSubmit()) return;

  // أوامر البث
  if (interaction.isChatInputCommand() && interaction.commandName === "play-live") {
    const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("📺 YONKO LIVE CONTROL 📻").setDescription("اختر القناة من القائمة للبدء:");
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId("select_channel").setPlaceholder("قنوات البث").addOptions(
        Object.entries(streams).map(([id, s]) => new StringSelectMenuOptionBuilder().setLabel(s.name).setValue(id))
      )
    );
    const btns = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_pause").setLabel("Pause").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("btn_resume").setLabel("Resume").setStyle(ButtonStyle.Success)
    );
    return interaction.reply({ embeds: [embed], components: [row, btns] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "select_channel") {
    const channel = interaction.guild.channels.cache.get(ALLOWED_VOICE_CHANNEL_ID);
    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    const player = createAudioPlayer();
    player.play(createAudioResource(streams[interaction.values[0]].url));
    connection.subscribe(player);
    return interaction.reply({ content: `🔊 تم تشغيل ${streams[interaction.values[0]].name}`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith("btn_")) {
    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) return interaction.reply({ content: "البوت ليس في القناة!", ephemeral: true });
    interaction.customId === "btn_pause" ? connection.state.subscription.player.pause() : connection.state.subscription.player.unpause();
    return interaction.reply({ content: "✅ تم التنفيذ.", ephemeral: true });
  }

  // أوامر الاقتراحات
  if (interaction.isChatInputCommand() && interaction.commandName === "setup-suggestion") {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("open_suggestion_modal").setLabel("Submit").setStyle(ButtonStyle.Primary));
    await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle("🔱 SUGGESTION HUB").setDescription("Click below.")], components: [row] });
    return interaction.reply({ content: "✅ Done.", ephemeral: true });
  }
  if (interaction.isButton() && interaction.customId === "open_suggestion_modal") {
    const modal = new ModalBuilder().setCustomId("suggestion_modal").setTitle("Submit Suggestion");
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("suggestion_input").setLabel("Your suggestion?").setStyle(TextInputStyle.Paragraph).setRequired(true)));
    return interaction.showModal(modal);
  }
  if (interaction.isModalSubmit() && interaction.customId === "suggestion_modal") {
    const adminChannel = interaction.guild.channels.cache.get(ADMIN_LOG_CHANNEL_ID);
    await adminChannel.send({ embeds: [new EmbedBuilder().setTitle("🔱 SUGGESTION 🔱").setDescription(interaction.fields.getTextInputValue("suggestion_input"))] });
    return interaction.reply({ content: "✅ Sent.", ephemeral: true });
  }
});

client.on("guildBanAdd", async (ban) => {
  const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildBanAdd }).catch(() => null);
  const banLog = fetchedLogs?.entries.first();
  if (banLog && ![EXCLUDED_BOT_1_ID, EXCLUDED_BOT_2_ID].includes(banLog.executor.id)) {
    const file = new AttachmentBuilder("./590606.jpg");
    await ban.user.send({ files: [file] }).catch(() => {});
  }
});

client.login(process.env.TOKEN);
