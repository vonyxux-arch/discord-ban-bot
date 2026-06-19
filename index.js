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
AuditLogEvent,
AttachmentBuilder
} = require("discord.js");

// استيراد المكونات الإضافية لإدارة الصوت والبث
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus 
} = require("@discordjs/voice");
const play = require("play-dl");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildModeration,
GatewayIntentBits.GuildVoiceStates // تم إضافة هذا الإنترنت لضمان عمل نظام تتبع الغرف الصوتية بدقة
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

// إعدادات ميزة البث المباشر الصوتي الجديدة
const VOICE_CHANNEL_ID = "1517510114830192711";
const TEXT_CHANNEL_ID = "1517509312774279238";
const YOUTUBE_STREAM = "https://www.youtube.com/live/bNyUyrR0PHo";

let voiceConnection = null;
let audioPlayer = null;
let voiceTimeout = null;

const commands = [
new SlashCommandBuilder()
.setName("setup-suggestion")
.setDescription("Deploy the suggestion panel button (Admin Only)."),
new ContextMenuCommandBuilder()
.setName("🚨 إبلاغ عن مخالفة") // تحويل اسم قائمة الإبلاغ إلى العربية الاحترافية
.setType(ApplicationCommandType.User)
].map(command => command.toJSON());

client.once("ready", async () => {
console.log(`[SYSTEM ONLINE] ${client.user.tag}`);
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
try {
await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
console.log("[PROTOCOL] Context Menus & Commands Synchronized.");
} catch (error) { console.error(error); }

// بدء الاتصال التلقائي بالغرفة الصوتية المحددة عند تشغيل البوت
await manageVoiceSystem();
});

// دالة التحكم الشاملة بنظام الصوت والبث التلقائي لمنع الكراش
async function manageVoiceSystem() {
    try {
        const channel = await client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isVoiceBased()) return;

        const humanCount = channel.members.filter(m => !m.user.bot).size;

        if (humanCount === 0) {
            // إذا لم يتواجد أي عضو حقيقي، يتم الاتصال وبدء العد التنازلي لـ 5 دقائق
            if (!voiceConnection) {
                initiateVoiceConnection(channel);
            }
            startVoiceCountdown();
        } else {
            // في حال وجود أعضاء، يتم إلغاء أي عد تنازلي وتأمين البث فوراً
            if (voiceTimeout) {
                clearTimeout(voiceTimeout);
                voiceTimeout = null;
            }
            if (!voiceConnection) {
                initiateVoiceConnection(channel);
            }
        }
    } catch (error) {
        console.error("[VOICE SYSTEM ERROR]", error);
    }
}

function initiateVoiceConnection(channel) {
    try {
        voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        audioPlayer = createAudioPlayer();
        voiceConnection.subscribe(audioPlayer);

        // التعامل الآمن مع حالات انقطاع الاتصال المفاجئ
        voiceConnection.on('stateChange', (oldState, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (voiceConnection) voiceConnection.destroy();
                voiceConnection = null;
                audioPlayer = null;
            }
        });

        setupAudioPlayerListeners();
        triggerStreamPlayback();
    } catch (err) {
        console.error("[CONNECTION INITIALIZATION ERROR]", err);
    }
}

function setupAudioPlayerListeners() {
    if (!audioPlayer) return;

    audioPlayer.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
            if (audioPlayer && voiceConnection) triggerStreamPlayback();
        }, 5000);
    });

    audioPlayer.on("error", (error) => {
        console.error("[AUDIO PLAYER ERROR]", error);
        setTimeout(() => {
            if (audioPlayer && voiceConnection) triggerStreamPlayback();
        }, 5000);
    });
}

async function triggerStreamPlayback() {
    if (!audioPlayer || !voiceConnection) return;
    try {
        const stream = await play.stream(YOUTUBE_STREAM).catch(err => {
            console.error("[PLAY-DL FETCH ERROR]", err);
            return null;
        });

        if (!stream) {
            setTimeout(() => {
                if (audioPlayer && voiceConnection) triggerStreamPlayback();
            }, 10000);
            return;
        }

        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        audioPlayer.play(resource);
    } catch (error) {
        console.error("[STREAM PLAYBACK EXECUTION ERROR]", error);
        setTimeout(() => {
            if (audioPlayer && voiceConnection) triggerStreamPlayback();
        }, 10000);
    }
}

function startVoiceCountdown() {
    if (voiceTimeout) return;
    voiceTimeout = setTimeout(() => {
        if (voiceConnection) {
            try {
                voiceConnection.destroy();
            } catch (e) { console.error(e); }
            voiceConnection = null;
            audioPlayer = null;
        }
        voiceTimeout = null;
        console.log("[VOICE TIMEOUT] Disconnected due to inactivity (No non-bot users).");
    }, 300000); // 5 دقائق تماماً
}

// تتبع تحديثات الغرفة الصوتية بشكل حي ومستمر
client.on("voiceStateUpdate", async (oldState, newState) => {
    if (oldState.channelId === VOICE_CHANNEL_ID || newState.channelId === VOICE_CHANNEL_ID) {
        await manageVoiceSystem();
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
.setDescription("Your mute has been removed.\n\nAlong with your access to the server.\n\n🚫 Permanently Banned.\nWa 3awd sb lah wla di almoul7id 🧏🏻‍♂️.")
.setImage("https://cdn.discordapp.com/attachments/1515911928118251600/1516900063333453895/Picsart_26-06-17_19-22-01-649.png?ex=6a35a445&is=6a3452c5&hm=060f02a051d788293268013b571db898471296bf930338dfbd6d464104ba24a5&")
.setAuthor({ name: "YONKO TEAM", iconURL: "https://cdn.discordapp.com/attachments/1515911928118251600/1516845528908959814/IMG_20260614_124632_519.webp?ex=6a341ffb&is=6a32ce7b&hm=e70ce9ec29c900a7dd80b5772dfbb7caad23565d3e068846170413fa1a871681&" })
.setTimestamp();
await member.send({ embeds: [finalBanEmbed] }).catch(() => {});
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

client.on("interactionCreate", async (interaction) => {
if (interaction.isChatInputCommand() && interaction.commandName === "setup-suggestion") {
if (!interaction.member.permissions.has("Administrator")) {
return interaction.reply({ content: "❌ لا تمتلك الصلاحيات الكافية لتنفيذ هذا الأمر.", ephemeral: true });
}
const hubChannel = interaction.guild.channels.cache.get(SUGGESTION_HUB_CHANNEL_ID);
if (!hubChannel) return interaction.reply({ content: "Error: Suggestion Hub channel not found.", ephemeral: true });
const panelEmbed = new EmbedBuilder()
.setColor(BRAND_COLOR)
.setTitle("🔱 ─── SERVER SUGGESTION HUB ─── 🔱")
.setDescription("أهلاً بك في منصة المقترحات الرسمية لخادم YONKO!\n\nاضغط على الزر أدناه لمشاركتنا فكرتك أو مقترحك لتطوير الخادم، وسيتم توجيهها فوراً إلى قسم الإدارة للمراجعة والتدقيق.\n\nشكرًا لكونك جزءًا من مسيرة تقدمنا!")
.setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517130067468226580/Picsart_26-06-18_12-33-02-521.jpg?ex=6a3528fa&is=6a33d77a&hm=c403f14ed0baf033fa2290485a178f555a5ffba8376e9dc2a0ec670bb659656a")
.setTimestamp()
.setFooter({ text: "YONKO TEAM • لوحة تحكم المقترحات", iconURL: interaction.guild.iconURL() });

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("open_suggestion_modal").setLabel("إرسال اقتراح جديد").setStyle(ButtonStyle.Primary).setEmoji("💡")
);
await interaction.reply({ content: "💻 تم نشر لوحة المقترحات بنجاح في الروم المخصص.", ephemeral: true });
return hubChannel.send({ embeds: [panelEmbed], components: [row] });
}

if (interaction.isButton() && interaction.customId === "open_suggestion_modal") {
const modal = new ModalBuilder().setCustomId("suggestion_modal").setTitle("تقديم اقتراح جديد لتطوير الخادم");
const textInput = new TextInputBuilder().setCustomId("suggestion_input").setLabel("ما هو مقترحك بالتفصيل؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
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
.setFooter({ text: "© YONKO TEAM | لوحة مراجعة طاقم الإدارة", iconURL: interaction.guild.iconURL() });   

const message = await adminChannel.send({ content: "🔔 **تم استلام اقتراح مجتمعي جديد:**", embeds: [embed] });   
await message.react("✨"); await message.react("🌑");    
return interaction.reply({ content: "💥 **رائع جداً! تم تشفير اقتراحك وإرساله مباشرة إلى سجل الإدارة لمراجعته في أقرب وقت.**", ephemeral: true });   
} catch (error) { console.error(error); return interaction.reply({ content: "Failure posting suggestion.", ephemeral: true }); }   
}   

if (interaction.isUserContextMenuCommand() && interaction.commandName === "🚨 إبلاغ عن مخالفة") {   
const lastReport = REPORT_COOLDOWN.get(interaction.user.id);   
if (lastReport && (Date.now() - lastReport < 300000)) {    
const timeLeft = Math.ceil((300000 - (Date.now() - lastReport)) / 1000);   
return interaction.reply({ content: `⚠️ نظام الحماية النشط: يرجى الانتظار ${timeLeft} ثانية قبل رفع بلاغ آخر لمنع الضغط الدفقّي.`, ephemeral: true });   
}   
if (interaction.targetUser.id === interaction.user.id) {   
return interaction.reply({ content: "❌ عذراً، لا يمكنك اتخاذ هذا الإجراء وتقديم بلاغ ضد نفسك.", ephemeral: true });   
}   
const modal = new ModalBuilder()   
.setCustomId(`report_modal_${interaction.targetUser.id}`)   
.setTitle(`إنشاء قضية بلاغ ضد: ${interaction.targetUser.username}`);   

const reasonInput = new TextInputBuilder()   
.setCustomId("report_reason")   
.setLabel("سبب المخالفة بالتفصيل")   
.setStyle(TextInputStyle.Paragraph)   
.setPlaceholder("يرجى كتابة وتوضيح القوانين والبنود التي قام العضو بخرقها هنا...")   
.setRequired(true);   

const evidenceInput = new TextInputBuilder()   
.setCustomId("report_evidence")   
.setLabel("رابط الدليل والروابط المرفقة")   
.setStyle(TextInputStyle.Paragraph)   
.setPlaceholder("ضع هنا روابط لقطات الشاشة أو روابط الرسائل التي تثبت المخالفة (اختياري)...")   
.setRequired(false);    

modal.addComponents(new ActionRowBuilder().addComponents(reasonInput), new ActionRowBuilder().addComponents(evidenceInput));   
return interaction.showModal(modal);   
}   

if (interaction.isModalSubmit() && interaction.customId.startsWith("report_modal_")) {   
const targetUserId = interaction.customId.replace("report_modal_", "");   
const targetUser = await client.users.fetch(targetUserId).catch(() => null);   
const reason = interaction.fields.getTextInputValue("report_reason");   
const evidence = interaction.fields.getTextInputValue("report_evidence") || "لم يتم توفير روابط أدلة صريحة.";   
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
{ name: "🖼️ | SUBMITTED EVIDENCE / METADATA", value: `\`\`\`yaml\n${evidence}\n\`\`\``, inline: false },   
{ name: "🕵️‍♂️ | REPORT SUBMITTED BY", value: `> ${interaction.user} (ID: ${interaction.user.id})`, inline: true }   
)   
.setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517154886574280915/Picsart_26-06-16_01-44-54-864.jpg?ex=6a354018&is=6a33ee98&hm=696c86e053ba1c3d80dd4d86317b526e9a5b4add0e09d628b369dbe9ab159cec&")   
.setThumbnail(targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : null)   
.setTimestamp()   
.setFooter({ text: "YONKO TEAM • قسم مكافحة الغش والحماية والأمن الداخلي", iconURL: interaction.guild.iconURL() });   

const actionRow = new ActionRowBuilder().addComponents(   
new ButtonBuilder().setCustomId(`report_accept_${interaction.user.id}`).setLabel("قبول وإقرار البلاغ").setStyle(ButtonStyle.Success).setEmoji("✅"),   
new ButtonBuilder().setCustomId(`report_reject_${interaction.user.id}`).setLabel("رفض وإسقاط البلاغ").setStyle(ButtonStyle.Danger).setEmoji("❌"),   
new ButtonBuilder().setCustomId(`report_archive_${interaction.user.id}`).setLabel("أرشفة القضية وغلقها").setStyle(ButtonStyle.Primary).setEmoji("🗂️")   
);   
await reportLogChannel.send({ content: "⚠️ @here **[SECURITY ENFORCEMENT ALERT] تم تسجيل وتأمين بلاغ مستخدم جديد بنجاح! يرجى مراجعة البيانات المرفقة:**", embeds: [reportEmbed], components: [actionRow] });   
return interaction.reply({ content: "✅ **تم تشفير بلاغك بالكامل وإرساله في خط حماية آمن ومباشر إلى سجلات طاقم العمل. شكراً لتعاونك المثمر!**", ephemeral: true });   
} catch (error) { console.error(error); return interaction.reply({ content: "Protocol Failure: Could not transmit report.", ephemeral: true }); }   
}   

if (interaction.isButton() && interaction.customId.startsWith("report_")) {   
if (!interaction.member.permissions.has("ManageMessages")) {    
return interaction.reply({ content: "❌ خطأ في الصلاحيات: يتطلب هذا الإجراء تصريح عمل إداري معتمد.", ephemeral: true });   
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
.setTitle("YONKO SECURITY SYSTEM")   
.setDescription("مرحباً بك،\n\nنود إخطارك بأنه قد تمت مراجعة بلاغك الأخير بعناية فائقة والموافقة عليه من قبل فريق الإدارة. تم التحقق من صحة وصلاحية الأدلة المقدمة، وجاري تطبيق الإجراءات الانضباطية المناسبة فوراً تجاه المخالف.\n\nنشكرك جزيلاً لجهودك ومساهمتك الدائمة في إبقاء مجتمعنا نظيفاً وآمناً!")   
.setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517154885513117918/Picsart_26-06-16_02-06-37-305.jpg?ex=6a354018&is=6a33ee98&hm=65126cf82239cd1a7c36117b147641c2b86f043226bd0d9b3dd5c26e4b109b34&")   
.setTimestamp();   
await reporter.send({ embeds: [acceptEmbed] });   
} catch (e) { console.log("Could not DM user."); }   
}   
return interaction.reply({ content: "✅ تم تحديث حالة القضية إلى: مقبول ومعتمد.", ephemeral: true });   
}   

if (action === "reject") {   
originalEmbed.setColor("#e74c3c").addFields({ name: "⚡ ACTION LOGGED", value: `> Rejected by ${interaction.user}`, inline: true });   
await interaction.message.edit({ embeds: [originalEmbed], components: [] });   
if (reporter) {   
try {   
const rejectEmbed = new EmbedBuilder()   
.setColor("#e74c3c")   
.setTitle("YONKO SECURITY SYSTEM")   
.setDescription("مرحباً بك،\n\nنتواصل معك لإعلامك بأنه قد تمت مراجعة بلاغك الأخير، وتقرر رفضه من قبل إدارة السيرفر. بعد التدقيق والفحص الشامل للبيانات والميتا-داتا، وجد الفريق أن الأدلة المرفقة غير كافية أو غير حاسمة لإثبات انتهاك القوانين المذكورة.\n\nنشكر تفهمك التام ودعمك المستمر لخادمنا.")   
.setImage("https://cdn.discordapp.com/attachments/1515530857010692320/1517154886041469008/Picsart_26-06-16_02-28-32-263.jpg?ex=6a354018&is=6a33ee98&hm=0be0e571c90ec7b47c203d8a83a11d3a493b88a3210c73229665c037b3160831&")   
.setTimestamp();   
await reporter.send({ embeds: [rejectEmbed] });   
} catch (e) { console.log("Could not DM user."); }   
}   
return interaction.reply({ content: "❌ تم تحديث حالة القضية إلى: مرفوض لعدم كفاية الأدلة.", ephemeral: true });   
}   

if (action === "archive") {   
originalEmbed.setColor("#34495e").addFields({ name: "⚡ ACTION LOGGED", value: `> Archived & Closed by ${interaction.user}`, inline: true });
await interaction.message.edit({ embeds: [originalEmbed], components: [] });
return interaction.reply({ content: "🗂️ تم حفظ الملف ونقله بنجاح للأرشيف المغلق.", ephemeral: true });
}
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
const dmBanEmbed = new EmbedBuilder()
.setColor(BRAND_COLOR)
.setTitle("🎮 GAME OVER | WASTED")
.setDescription(`Well, looks like you either broke one of our strict rules or simply managed to trigger an angry moderator.`)
.setImage("attachment://590606.jpg")
.setTimestamp();
await ban.user.send({ embeds: [dmBanEmbed], files: [file] }).catch(() => {});
} catch (error) { console.error(error); }
});

clien
