const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const ROLE_ID = "1516616022352859278";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const hadRole = oldMember.roles.cache.has(ROLE_ID);
  const hasRole = newMember.roles.cache.has(ROLE_ID);

  if (!hadRole && hasRole) {
    console.log(`${newMember.user.tag} received the role`);

    setTimeout(async () => {
      try {
        const member = await newMember.guild.members.fetch(newMember.id);

        if (member.roles.cache.has(ROLE_ID)) {
          await member.ban({
            reason: "Received monitored role"
          });

          console.log(`Banned ${member.user.tag}`);
        }
      } catch (err) {
        console.error(err);
      }
    }, 30000); // 30 ثانية
  }
});

client.login(process.env.TOKEN);
