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
  TextInputStyle,
  StringSelectMenuBuilder,
  AuditLogEvent,
  AttachmentBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
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
  new SlashCommandBuilder()
    .setName("setup-suggestion")
    .setDescription("Deploy the suggestion panel button (Admin Only)."),
  new ContextMenuCommandBuilder()
    .setName("🚨 Report Violation")
    .setType(ApplicationCommandType.User)
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`[SYSTEM ONLINE] ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("[PROTOCOL] Context Menus & Commands Synchronized.");
  } catch (error) { 
    console.error(error); 
  }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!oldMember.roles.cache.has(BAN_ROLE_ID) && newMember.roles.cache.has(BAN_ROLE_ID)) {
    BAN_TRACKER.add(newMember.id);
    setTimeout(async () => {
      try {
        const member = await newMember.guild.members.fetch(newMember.id).catch(() => null);
        if (member && member.roles.cache.has(BAN_ROLE_ID)) {
          const finalBanEmbed = new EmbedBuilder()
            .setColor(BRAND_COLOR)
            .setTitle("🔨 Congratulations")
            .setDescription("Your mute has been removed.\n\nAlong with your access to the server.\n\n🚫 Permanently Banned.\nWa 3awd sb lah wla di almoul7id 🧏形.")
            .setImage("https://cdn.discordapp.com/attachments/1515911928118251600/1516900063333453895/Picsart_26-06-17_19-22-01-649.png?ex=6a35a445&is=6a3452c5&hm=060f02a051d788293268013b571db898471296bf930338dfbd6d464104ba24a5&")
            .setAuthor({ name: "YONKO TEAM", iconURL: "https://cdn.discordapp.com/attachments/1515911928118251600/1516845528908959814/IMG_20260614_124632_519.webp?ex=6a341ffb&is=6a32ce7b&hm=e70ce9ec29c900a7dd80b5772dfbb7caad23565d3e068846170413fa1a871681&" })
            .setTimestamp();
          await member.send({ embeds: [finalBanEmbed] }).catch(() => {});
          await member.ban({ reason: "Security Enforcement: Monitored role timeout reached." });
          BAN_TRACKER.delete(newMember.id);
        }
      } catch (err) { 
        console.error(err); 
      }
    }, 30000);
  }
});

client.on("guildMemberAdd", async (member) => {
  if (BAN_TRACKER.has(member.id)) {
    try {
      await member.ban({ reason: "Security Enforcement: Anti-Leave Bypass detected. Instant Ban applied." });
      BAN_TRACKER.delete(member.id);
    } catch (err) { 
      console.error(err); 
    }
  }
});

client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand() && interaction.commandName === "setup-suggestion") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({ content: "❌ You do not have sufficient permissions to execute this command.", ephemeral: true });
    }
    const hubChannel = interaction.guild.channels.cache.get(SUGGESTION_HUB_CHANNEL_ID);
    if (!hubChannel) return interaction.reply({ content: "Error: Suggestion Hub channel not found.", ephemeral: true });
    
    const panelEmbed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle("🔱 ─── SERVER SUGGESTION HUB ─── 🔱")
      .setDescription("Welcome!\n\nWe're happy to have you here. Click the button below to submit your suggestion, and it will be sent directly to the administration team for review.\n\nThank you for helping us improve the server!")
      .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517130067468226580/Picsart_26-06-18_12-33-02-521.jpg?ex=6a3528fa&is=6a33d77a&hm=c403f14ed0baf033fa2290485a178f555a5ffba8376e9dc2a0ec670bb659656a")
      .setTimestamp()
      .setFooter({ text: "YONKO TEAM • Suggestion Control Panel", iconURL: interaction.guild.iconURL() });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_suggestion_modal").setLabel("Submit Suggestion").setStyle(ButtonStyle.Primary).setEmoji("💡")
    );
    await interaction.reply({ content: "💻 Suggestion panel has been deployed successfully.", ephemeral: true });
    return hubChannel.send({ embeds: [panelEmbed], components: [row] });
  }

  if (interaction.isButton() && interaction.customId === "open_suggestion_modal") {
    const modal = new ModalBuilder().setCustomId("suggestion_modal").setTitle("Submit a New Suggestion");
    const textInput = new TextInputBuilder().setCustomId("suggestion_input").setLabel("What is your suggestion in detail?").setStyle(TextInputStyle.Paragraph).setRequired(true);
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
        .setDescription(`\n**🧑‍💻 | COMMUNITY SUGGESTION:**\n\`\`\`fix\n${suggestionText}\n\`\`\`\n`)   
        .addFields({ name: "📡 | SUGGESTED BY", value: `> ${interaction.user}`, inline: true }, { name: "🛡️ | STATUS", value: `> PENDING REVIEW`, inline: true })   
        .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517141518744293396/Picsart_26-06-18_13-16-11-070.jpg?ex=6a3533a5&is=6a33e225&hm=8455641086dca5a3ce07de377ef9d5aceebef98c3701521a5c8667e5731ac983&")   
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))   
        .setTimestamp()   
        .setFooter({ text: "© YONKO TEAM | Staff Review Dashboard", iconURL: interaction.guild.iconURL() });   

      const message = await adminChannel.send({ content: "🔔 **A new community suggestion has been submitted:**", embeds: [embed] });   
      await message.react("✨"); 
      await message.react("🌑");    
      return interaction.reply({ content: "💥 **Awesome! Your suggestion has been securely sent directly to the administration logs for review.**", ephemeral: true });   
    } catch (error) { 
      console.error(error); 
      return interaction.reply({ content: "Failure posting suggestion.", ephemeral: true }); 
    }   
  }   

  if (interaction.isUserContextMenuCommand() && interaction.commandName === "🚨 Report Violation") {   
    const lastReport = REPORT_COOLDOWN.get(interaction.user.id);   
    if (lastReport && (Date.now() - lastReport < 300000)) {    
      const timeLeft = Math.ceil((300000 - (Date.now() - lastReport)) / 1000);   
      return interaction.reply({ content: `⚠️ Rate Limit Active: Please wait ${timeLeft} seconds before filing another report to prevent spam.`, ephemeral: true });   
    }   
    if (interaction.targetUser.id === interaction.user.id) {   
      return interaction.reply({ content: "❌ Error: You cannot file a report against yourself.", ephemeral: true });   
    }   
    const modal = new ModalBuilder()   
      .setCustomId(`report_modal_${interaction.targetUser.id}`)   
      .setTitle(`File Report Against: ${interaction.targetUser.username}`);   

    const reasonInput = new TextInputBuilder()   
      .setCustomId("report_reason")   
      .setLabel("Detailed Reason for Report")   
      .setStyle(TextInputStyle.Paragraph)   
      .setPlaceholder("Please explain which rules or guidelines this member violated...")   
      .setRequired(true);   

    const evidenceInput = new TextInputBuilder()   
      .setCustomId("report_evidence")   
      .setLabel("Evidence Links / Attachments")   
      .setStyle(TextInputStyle.Paragraph)   
      .setPlaceholder("Paste screenshot links or message links proving the violation (Optional)...")   
      .setRequired(false);    

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput), new ActionRowBuilder().addComponents(evidenceInput));   
    return interaction.showModal(modal);   
  }   

  if (interaction.isModalSubmit() && interaction.customId.startsWith("report_modal_")) {   
    const targetUserId = interaction.customId.replace("report_modal_", "");   
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);   
    const reason = interaction.fields.getTextInputValue("report_reason");   
    const evidence = interaction.fields.getTextInputValue("report_evidence") || "No explicit evidence links provided.";   
    const reportLogChannel = interaction.guild.channels.cache.get(REPORT_LOG_CHANNEL_ID);   
    if (!reportLogChannel) return interaction.reply({ content: "Configuration Error: Admin logs channel not found.", ephemeral: true });   
    try {   
      REPORT_COOLDOWN.set(interaction.user.id, Date.now());    
      const reportEmbed = new EmbedBuilder()   
        .setColor("#D92121")   
        .setAuthor({ name: `INCIDENT SYSTEM | CASE ID: #${Math.floor(10000 + Math.random() * 90000)}`, iconURL: interaction.guild.iconURL() })   
        .setTitle("NEW RULE VIOLATION FILED")   
        .addFields(   
          { name: "👤 | TARGET OFFENDER", value: `> ${targetUser} (ID: ${targetUserId})`, inline: false },   
          { name: "📝 | REASON FOR FILED REPORT", value: `\`\`\`fix\n${reason}\n\`\`\``, inline: false },   
          { name: "🖼 | SUBMITTED EVIDENCE / METADATA", value: `\`\`\`yaml\n${evidence}\n\`\`\``, inline: false },   
          { name: "🕵️‍♂️ | REPORT SUBMITTED BY", value: `> ${interaction.user} (ID: ${interaction.user.id})`, inline: true }   
        )   
        .setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517154886574280915/Picsart_26-06-16_01-44-54-864.jpg?ex=6a354018&is=6a33ee98&hm=696c86e053ba1c3d80dd4d86317b526e9a5b4add0e09d628b369dbe9ab159cec&")   
        .setThumbnail(targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : null)   
        .setTimestamp()   
        .setFooter({ text: "YONKO TEAM • Security & Internal Affairs Department", iconURL: interaction.guild.iconURL() });   

      const actionRow = new ActionRowBuilder().addComponents(   
        new ButtonBuilder().setCustomId(`report_accept_${interaction.user.id}`).setLabel("Accept & Enforce").setStyle(ButtonStyle.Success).setEmoji("✅"),   
        new ButtonBuilder().setCustomId(`report_reject_${interaction.user.id}`).setLabel("Reject & Dismiss").setStyle(ButtonStyle.Danger).setEmoji("❌"),   
        new ButtonBuilder().setCustomId(`report_archive_${interaction.user.id}`).setLabel("Archive Case").setStyle(ButtonStyle.Primary).setEmoji("🗂️")   
      );   
      await reportLogChannel.send({ content: "⚠️ @here **[SECURITY ENFORCEMENT ALERT] A new user report has been filed. Review the case details below:**", embeds: [reportEmbed], components: [actionRow] });   
      return interaction.reply({ content: "✅ **Your report has been encrypted and successfully transmitted to the staff logs. Thank you for helping keep the server safe!**", ephemeral: true });   
    } catch (error) { 
      console.error(error); 
      return interaction.reply({ content: "Protocol Failure: Could not transmit report.", ephemeral: true }); 
    }   
  }   

  if (interaction.isButton() && interaction.customId.startsWith("report_")) {   
    if (!interaction.member.permissions.has("ManageMessages")) {    
      return interaction.reply({ content: "❌ Permission Error: This action requires official administrative clearance.", ephemeral: true });   
    }   
    const parts = interaction.customId.split("_");   
    const action = parts[1];    
    const reporterId = parts[2];    
    const reporter = await client.users.fetch(reporterId).catch(() => null);   

    let updateStatusText = "";
    if (action === "accept") updateStatusText = "🟢 Report Accepted & Enforced by Administration.";
    if (action === "reject") updateStatusText = "🔴 Report Rejected & Dismissed by Administration.";
    if (action === "archive") updateStatusText = "🔵 Case Closed & Archived.";

    const currentEmbed = interaction.message.embeds[0];
    if (currentEmbed) {
      const updatedEmbed = EmbedBuilder.from(currentEmbed)
        .addFields({ name: "⚖️ Administrative Action Taken", value: `> Moderated by: ${interaction.user}\n> Status: ${updateStatusText}` });
      
      await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
    }

    return interaction.reply({ content: `✅ Case updated successfully: ${updateStatusText}`, ephemeral: true });
  }   
});

client.login(process.env.TOKEN);
        
