const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// معرف الرتبة الخاص بك
const ROLE_ID = "1516616022352859278"; 

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const hadRole = oldMember.roles.cache.has(ROLE_ID);
  const hasRole = newMember.roles.cache.has(ROLE_ID);

  if (!hadRole && hasRole) {
    console.log(`${newMember.user.tag} received the role. Ban timer started.`);

    setTimeout(async () => {
      try {
        const member = await newMember.guild.members.fetch(newMember.id).catch(() => null);
        
        if (!member) {
          console.log("Member left or is no longer accessible.");
          return;
        }

        if (member.roles.cache.has(ROLE_ID)) {  
          await member.ban({  
            reason: "Received monitored role and 30 seconds passed."  
          });  
          console.log(`Successfully banned ${member.user.tag}`);  
        } else {
          console.log(`Role was removed from ${member.user.tag} before 30 seconds. Ban canceled.`);
        }

      } catch (err) {
        console.error("Failed to ban member:", err);
      }
    }, 30000);
  }
});

client.login(process.env.TOKEN);
