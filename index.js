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

  // إذا أخذ الرتبة → BAN فوري
  if (!hadRole && hasRole) {
    console.log(`${newMember.user.tag} got the role → banning`);

    try {
      await newMember.ban({
        reason: "Received restricted role"
      });

      console.log(`Banned ${newMember.user.tag}`);
    } catch (err) {
      console.error("Ban failed:", err);
    }
  }
});

client.login(process.env.TOKEN);
