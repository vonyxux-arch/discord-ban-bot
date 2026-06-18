const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ContextMenuCommandBuilder,
  ApplicationCommandType,
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

// قنوات الاقتراحات
const SUGGESTION_HUB_CHANNEL_ID = "1516999923470565516"; 
const ADMIN_LOG_CHANNEL_ID = "1515161056975126705"; 

// قنوات البلاغات
const REPORT_LOG_CHANNEL_ID = "1515161056975126705"; // روم الأدمنز والمودز السرية لاستقبال البلاغات

const BRAND_COLOR = "#FF750D"; 
const BAN_TRACKER = new Set(); 
const REPORT_COOLDOWN = new Map(); // حماية ضد السبام

// ================= [ Registration / تسجيل الأنظمة والأوامر ] =================

const commands = [
  new SlashCommandBuilder()
    .setName("setup-suggestion")
    .setDescription("Deploy the suggestion panel button (Admin Only)."),
  // تم تحديث الاسم هنا إلى 🚨 REPORT TO 4KO
  new ContextMenuCommandBuilder()
    .setName("🚨 REPORT TO 4KO")
    .setType(ApplicationCommandType.User)
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`[SYSTEM ONLINE] ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("[PROTOCOL] Context Menus & Commands Synchronized.");
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
    } catch (err) { console.error(err); }
  }
});

// ================= [ Core Interaction Handling / المعالجة الذكية ] =================

client.on("interactionCreate", async (interaction) => {
  
  // ---------------- [ SECTION 1: SUGGESTIONS ] ----------------
  if (interaction.isChatInputCommand() && interaction.commandName === "setup-suggestion") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ You don't have permission to use this.", ephemeral: true });
    }
    const hubChannel = interaction.guild.channels.cache.get(SUGGESTION_HUB_CHANNEL_ID);
    if (!hubChannel) return interaction.reply({ content: "Error: Suggestion Hub channel not found.", ephemeral: true });

    const panelEmbed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle("🔱 ─── SERVER SUGGESTION HUB ─── 🔱")
      .setDescription("Welcome!\n\nClick the button below to submit your suggestion, and it will be sent directly to the administration team.\n\nThank you for helping us improve!")
      .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517130067468226580/Picsart_26-06-18_12-33-02-521.jpg?ex=6a3528fa&is=6a33d77a&hm=c403f14ed0baf033fa2290485a178f555a5ffba8376e9dc2a0ec670bb659656a")
      .setTimestamp() 
      .setFooter({ text: "YONKO TEAM • Suggestions Panel", iconURL: interaction.guild.iconURL() });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_suggestion_modal").setLabel("Submit Suggestion").setStyle(ButtonStyle.Primary).setEmoji("💡")
    );
    await interaction.reply({ content: "🧑🏻‍💻 Panel deployed successfully.", ephemeral: true });
    return hubChannel.send({ embeds: [panelEmbed], components: [row] });
  }

  if (interaction.isButton() && interaction.customId === "open_suggestion_modal") {
    const modal = new ModalBuilder().setCustomId("suggestion_modal").setTitle("🧑🏻‍💻 Submit Your Suggestion");
    const textInput = new TextInputBuilder().setCustomId("suggestion_input").setLabel("What is your suggestion?").setStyle(TextInputStyle.Paragraph).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "suggestion_modal") {
    const suggestionText = interaction.fields.getTextInputValue("suggestion_input");
    const adminChannel = interaction.guild.channels.cache.get(ADMIN_LOG_CHANNEL_ID);
    if (!adminChannel) return interaction.reply({ content: "Error: Admin log channel not found.", ephemeral: true });

    try {
      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setAuthor({ name: `NEW PROPOSAL | ID: #${Math.floor(1000 + Math.random() * 9000)}`, iconURL: interaction.guild.iconURL() })
        .setTitle("🔱 ─── SERVER SUGGESTION HUB ─── 🔱")
        .setDescription(`\n**🧑🏻‍💻 | COMMUNITY SUGGESTION:**\n\`\`\`fix\n${suggestionText}\`\`\`\n`)
        .addFields({ name: "📡 | SUGGESTED BY", value: `> ${interaction.user}`, inline: true }, { name: "🛡️ | STATUS", value: `> \`PENDING REVIEW\``, inline: true })
        .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517141518744293396/Picsart_26-06-18_13-16-11-070.jpg?ex=6a3533a5&is=6a33e225&hm=8455641086dca5a3ce07de377ef9d5aceebef98c3701521a5c8667e5731ac983&")
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `© YONKO TEAM | Staff Review Panel`, iconURL: interaction.guild.iconURL() });

      const message = await adminChannel.send({ content: "🔔 **New suggestion received:**", embeds: [embed] });
      await message.react("✨"); await message.react("🌑"); 
      return interaction.reply({ content: "💥 **Boom! Your suggestion has been sent straight to the administration team.**", ephemeral: true });
    } catch (error) { console.error(error); return interaction.reply({ content: "Failure posting suggestion.", ephemeral: true }); }
  }

  // ---------------- [ SECTION 2: USER CONTEXT MENU REPORT ] ----------------
  
  // استقبال وضغط الزر المحدث بالاسم الجديد
  if (interaction.isUserContextMenuCommand() && interaction.commandName === "🚨 REPORT TO 4KO") {
    const lastReport = REPORT_COOLDOWN.get(interaction.user.id);
    if (lastReport && (Date.now() - lastReport < 300000)) { 
      const timeLeft = Math.ceil((300000 - (Date.now() - lastReport)) / 1000);
      return interaction.reply({ content: `⚠️ **Calm down! Please wait ${timeLeft} seconds before submitting another report.**`, ephemeral: true });
    }

    if (interaction.targetUser.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot report yourself.", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`report_modal_${interaction.targetUser.id}`)
      .setTitle(`🚨 Report: ${interaction.targetUser.username}`);

    const reasonInput = new TextInputBuilder()
      .setCustomId("report_reason")
      .setLabel("Violation Reason / ما هي المخالفة؟")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Describe clearly what rules this user broke...")
      .setRequired(true);

    const evidenceInput = new TextInputBuilder()
      .setCustomId("report_evidence")
      .setLabel("Evidence Link / الدليل (رابط صورة أو تعليق)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Paste screenshot links or comments here (Optional)...")
      .setRequired(false); 

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput), new ActionRowBuilder().addComponents(evidenceInput));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("report_modal_")) {
    const targetUserId = interaction.customId.replace("report_modal_", "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    const reason = interaction.fields.getTextInputValue("report_reason");
    const evidence = interaction.fields.getTextInputValue("report_evidence") || "No explicit links provided.";

    const reportLogChannel = interaction.guild.channels.cache.get(REPORT_LOG_CHANNEL_ID);
    if (!reportLogChannel) return interaction.reply({ content: "Configuration Error: Admin logs channel not found.", ephemeral: true });

    try {
      REPORT_COOLDOWN.set(interaction.user.id, Date.now()); 

      const reportEmbed = new EmbedBuilder()
        .setColor("#D92121")
        .setAuthor({ name: `🚨 INCIDENT SYSTEM | CASE ID: #${Math.floor(10000 + Math.random() * 90000)}`, iconURL: interaction.guild.iconURL() })
        .setTitle("⚠️ NEW RULE VIOLATION FILED")
        .addFields(
          { name: "👤 | TARGET OFFENDER", value: `> ${targetUser} (ID: ${targetUserId})`, inline: false },
          { name: "📝 | REASON FOR FILED REPORT", value: `\`\`\`fix\n${reason}\n\`\`\``, inline: false },
          { name: "🖼️ | SUBMITTED EVIDENCE / METADATA", value: `\`\`\`yaml\n${evidence}\n\`\`\``, inline: false },
          { name: "🕵️‍♂️ | REPORT SUBMITTED BY", value: `> ${interaction.user} (ID: ${interaction.user.id})`, inline: true }
        )
        .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517154886041469008/Picsart_26-06-16_02-28-32-263.jpg?ex=6a354018&is=6a33ee98&hm=0be0e571c90ec7b47c203d8a83a11d3a493b88a3210c73229665c037b3160831&")
        .setThumbnail(targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : null)
        .setTimestamp()
        .setFooter({ text: "YONKO TEAM • Anti-Cheat & Security", iconURL: interaction.guild.iconURL() });

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`report_accept_${interaction.user.id}`).setLabel("Accept Report").setStyle(ButtonStyle.Success).setEmoji("✅"),
        new ButtonBuilder().setCustomId(`report_reject_${interaction.user.id}`).setLabel("Reject Report").setStyle(ButtonStyle.Danger).setEmoji("❌"),
        new ButtonBuilder().setCustomId(`report_archive_${interaction.user.id}`).setLabel("Archive & Close").setStyle(ButtonStyle.Primary).setEmoji("🗂️")
      );

      await reportLogChannel.send({ content: "⚠️ @here **[SECURITY ENFORCEMENT ALERT] A user report has been locked in! Review details:**", embeds: [reportEmbed], components: [actionRow] });
      return interaction.reply({ content: "✅ **Your violation report has been securely encrypted and routed directly to the staff logs. Thank you!**", ephemeral: true });
    } catch (error) { console.error(error); return interaction.reply({ content: "Protocol Failure: Could not transmit report.", ephemeral: true }); }
  }

  // ---------------- [ SECTION 3: STAFF REPORT ACTION BUTTONS ] ----------------
  
  if (interaction.isButton() && interaction.customId.startsWith("report_")) {
    if (!interaction.member.permissions.has("ManageMessages")) { 
      return interaction.reply({ content: "❌ Authorized staff clearance required to trigger status actions.", ephemeral: true });
    }

    const parts = interaction.customId.split("_");
    const action = parts[1]; 
    const reporterId = parts[2]; 
    const reporter = await client.users.fetch(reporterId).catch(() => null);

    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);

    if (action === "accept") {
      originalEmbed.setColor("#2ecc71").addFields({ name: "⚡ ACTION LOGGED", value: `> Accepted by ${interaction.user}`, inline: true });
      await interaction.message.edit({ embeds: [originalEmbed], components: [] }); 

      if (reporter) {
        try {
          const acceptEmbed = new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("⚜️ ─── YONKO SECURITY LOG ─── ⚜️")
            .setDescription("أهلاً بك يا بطل،\n\nلقد تم مراجعة البلاغ الذي قدمته بنجاح وتبين صحة البيانات. نشكرك على وعيك وحرصك على أمان السيرفر، وتم اتخاذ الإجراءات والتدابير اللازمة فوراً ضد العضو المخالف.\n\nاستمر في دعم مجتمعنا! 🛡️")
            .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517154885513117918/Picsart_26-06-16_02-06-37-305.jpg?ex=6a354018&is=6a33ee98&hm=65126cf82239cd1a7c36117b147641c2b86f043226bd0d9b3dd5c26e4b109b34&")
            .setTimestamp();
          await reporter.send({ embeds: [acceptEmbed] });
        } catch (e) { console.log(`Could not DM user ${reporterId} - DMs locked.`); }
      }
      return interaction.reply({ content: "✅ Report marked as Accepted, user notified.", ephemeral: true });
    }

    if (action === "reject") {
      originalEmbed.setColor("#e74c3c").addFields({ name: "⚡ ACTION LOGGED", value: `> Rejected by ${interaction.user}`, inline: true });
      await interaction.message.edit({ embeds: [originalEmbed], components: [] });

      if (reporter) {
        try {
          const rejectEmbed = new EmbedBuilder()
            .setColor("#e74c3c")
            .setTitle("⚜️ ─── YONKO SECURITY LOG ─── ⚜️")
            .setDescription("أهلاً بك،\n\nنود إعلامك بأنه بعد المراجعة الدقيقة والتحري حول البلاغ الذي تقدمت به، لم يتبين لنا وجود أدلة كافية أو واضحة تؤكد ارتكاب المخالفة المذكورة. بناءً على ذلك، تقرر رد هذا البلاغ وحفظه.\n\nنشكرك على تفهمك ومحاولتك المساعدة.")
            .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517154886574280915/Picsart_26-06-16_01-44-54-864.jpg?ex=6a354018&is=6a33ee98&hm=696c86e053ba1c3d80dd4d86317b526e9a5b4add0e09d628b369dbe9ab159cec&")
            .setTimestamp();
          await reporter.send({ embeds: [rejectEmbed] });
        } catch (e) { console.log(`Could not DM user ${reporterId} - DMs locked.`); }
      }
      return interaction.reply({ content: "❌ Report marked as Rejected, user notified via DM.", ephemeral: true });
    }

    if (action === "archive") {
      originalEmbed.setColor("#34495e").addFields({ name: "⚡ ACTION LOGGED", value: `> Archived & Closed by ${interaction.user}`, inline: true });
      await interaction.message.edit({ embeds: [originalEmbed], components: [] });
      return interaction.reply({ content: "🗂️ Case archived and locked successfully.", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
    
