const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers // ضروري جداً لرصد تحديثات الأعضاء ورتبهم
  ]
});

// معرف الرتبة الخاص بك الذي أرسلته
const ROLE_ID = "1516616022352859278"; 

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const hadRole = oldMember.roles.cache.has(ROLE_ID);
  const hasRole = newMember.roles.cache.has(ROLE_ID);

  // إذا لم تكن لديه الرتبة وحصل عليها الآن
  if (!hadRole && hasRole) {
    console.log(`${newMember.user.tag} received the role. Ban timer started.`);

    setTimeout(async () => {
      try {
        // جلب بيانات العضو مجدداً للتأكد من حالته الحالية بعد 30 ثانية
        const member = await newMember.guild.members.fetch(newMember.id).catch(() => null);
        
        if (!member) {
          console.log("Member left or is no longer accessible.");
          return;
        }

        // التحقق مما إذا كانت الرتبة لا تزال معه بعد مرور الـ 30 ثانية
        if (member.roles.cache.has(ROLE_ID)) {  
          await member.ban({  
            reason: "Received monitored role and 30 seconds passed."  
          });  
          console.log(`Successfully banned ${member.user.tag}`);  
        } else {
          console.log(`Role was removed from ${member.user.tag} before 30 seconds. Ban canceled.`);
        }

      } catch (err
        
