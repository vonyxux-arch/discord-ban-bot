const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= [ Configuration / الإعدادات ] =================

const BAN_ROLE_ID = "1516616022352859278"; 
const SUGGESTION_HUB_CHANNEL_ID = "1516999923470565516"; // روم اللوحة العامة للأعضاء
const ADMIN_LOG_CHANNEL_ID = "1515161056975126705"; // روم الموديراتورز والأدمنز السرية

const BRAND_COLOR = "#FF750D"; 
const BAN_TRACKER = new Set(); 

// ================= [ Registration / تسجيل الأوامر الإدارية ] =================

const commands = [
  new SlashCommandBuilder()
    .setName("setup-suggestion")
    .setDescription("Deploy the suggestion panel button (Admin Only).")
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`[SYSTEM ONLINE] ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("[PROTOCOL] Deployment commands synchronized.");
  } catch (error) { console.error(error); }
});

// ================= [ Anti-Leave Bypass Protocol / نظام حظر الهاربين ] =================

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!oldMember.roles.cache.has(BAN_ROLE_ID) && newMember.roles.cache.has(BAN_ROLE_ID)) {
    BAN_TRACKER.add(newMember.id); 

    setTimeout(async () => {
      try {
        const member = await newMember.guild.members.fetch(newMember.id).catch(() => null);
        if (member && member.roles.cache.has(BAN_ROLE_ID)) {
          await member.ban({ reason: "Security Enforcement: Monitored role timeout reached." });
          BAN_TRACKER.delete(newMember.id);
        }
      } catch (err) { console.error(err); }
    }, 30000);
  }
});

client.on("guildMemberAdd", async (member) => {
  if (BAN_TRACKER.has(member.id)) {
    try {
      await member.ban({ reason: "Security Enforcement: Anti-Leave Bypass detected. Instant Ban applied." });
      BAN_TRACKER.delete(member.id);
      console.log(`[INSTANT BAN] ${member.user.tag} tried to bypass the timer by leaving.`);
    } catch (err) { console.error(err); }
  }
});

// ================= [ Suggestion Core Logic / نظام الأزرار والنوافذ ] =================

client.on("interactionCreate", async (interaction) => {
  
  // 1. أمر تشغيل اللوحة (Admin Only)
  if (interaction.isChatInputCommand() && interaction.commandName === "setup-suggestion") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ You don't have permission to use this.", ephemeral: true });
    }

    const hubChannel = interaction.guild.channels.cache.get(SUGGESTION_HUB_CHANNEL_ID);
    if (!hubChannel) return interaction.reply({ content: "Error: Suggestion Hub channel not found in configuration.", ephemeral: true });

    const panelEmbed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle("🔱 ─── SERVER SUGGESTION HUB ─── 🔱")
      .setDescription(
        "Welcome!\n\n" +
        "We're happy to have you here. Click the button below to submit your suggestion, and it will be sent directly to the administration team for review.\n\n" +
        "Thank you for helping us improve the server!"
      )
      .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517130067468226580/Picsart_26-06-18_12-33-02-521.jpg?ex=6a3528fa&is=6a33d77a&hm=c403f14ed0baf033fa2290485a178f555a5ffba8376e9dc2a0ec670bb659656a")
      .setTimestamp() 
      .setFooter({ 
        text: "YONKO TEAM • Suggestions Panel", 
        iconURL: interaction.guild.iconURL() 
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_suggestion_modal")
        .setLabel("Submit Suggestion")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("💡")
    );

    await interaction.reply({ content: "🧑🏻‍💻 Panel deployed successfully.", ephemeral: true });
    return hubChannel.send({ embeds: [panelEmbed], components: [row] });
  }

  // 2. فتح النافذة المنبثقة عند ضغط الزر
  if (interaction.isButton() && interaction.customId === "open_suggestion_modal") {
    const modal = new ModalBuilder()
      .setCustomId("suggestion_modal")
      .setTitle("🧑🏻‍💻 Submit Your Suggestion");

    const textInput = new TextInputBuilder()
      .setCustomId("suggestion_input")
      .setLabel("What is your suggestion?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Type your suggestion details here...")
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    return interaction.showModal(modal);
  }

  // 3. استقبال ومعالجة البيانات وإرسالها لروم المودز والأدمنز
  if (interaction.isModalSubmit() && interaction.customId === "suggestion_modal") {
    const suggestionText = interaction.fields.getTextInputValue("suggestion_input");
    const adminChannel = interaction.guild.channels.cache.get(ADMIN_LOG_CHANNEL_ID);

    if (!adminChannel) return interaction.reply({ content: "Error: Admin log channel not found. Please check setup.", ephemeral: true });

    try {
      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setAuthor({ name: `NEW PROPOSAL | ID: #${Math.floor(1000 + Math.random() * 9000)}`, iconURL: interaction.guild.iconURL() })
        .setTitle("🔱 ─── SERVER SUGGESTION HUB ─── 🔱")
        .setDescription(`\n**🧑🏻‍💻 | COMMUNITY SUGGESTION:**\n\`\`\`fix\n${suggestionText}\`\`\`\n`)
        .addFields(
          { name: "📡 | SUGGESTED BY", value: `> ${interaction.user}`, inline: true },
          { name: "🛡️ | STATUS", value: `> \`PENDING REVIEW\``, inline: true }
        )
        // الصورة الجديدة المخصصة لرسالة الإدارة والمودز
        .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517141518744293396/Picsart_26-06-18_13-16-11-070.jpg?ex=6a3533a5&is=6a33e225&hm=8455641086dca5a3ce07de377ef9d5aceebef98c3701521a5c8667e5731ac983&")
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `© YONKO TEAM | Staff Review Panel`, iconURL: interaction.guild.iconURL() });

      const message = await adminChannel.send({ content: "🔔 **New suggestion received for administration review:**", embeds: [embed] });
      await message.react("✨"); 
      await message.react("🌑"); 

      // تظهر للعضو الذي ضغط الزر فقط بشكل مخفي تماماً (Ephemeral)
      return interaction.reply({ content: "💥 **Boom! Your suggestion has been sent straight to the administration team. Thanks for helping us grow!**", ephemeral: true });
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: "Protocol Failure: Error posting suggestion to admin log.", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
        
