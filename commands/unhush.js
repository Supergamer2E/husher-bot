// commands/unhush.js
export default async function (interaction, { userTimeouts, activeTimers, loadCustomComebacks }) {
    const target = interaction.options.getUser('target');
    const reduce = interaction.options.getBoolean('reduce-offense');
    const member = await interaction.guild.members.fetch(target.id);
    const channel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

    if (activeTimers.has(target.id)) {
        clearInterval(activeTimers.get(target.id));
        activeTimers.delete(target.id);
    }

    try {
        await member.timeout(null);
    } catch {}

    if (reduce && userTimeouts[target.id]) {
        userTimeouts[target.id] = Math.max(0, userTimeouts[target.id] - 1);
    }

    const msg = loadCustomComebacks().concat([
        '🧙 {user} has returned from the Forbidden Section of chat.',
        '💬 {user} can speak again. The silence was nice.',
        '🛏️ {user} has left the timeout dimension.',
        '🎮 {user} has re-entered the game.',
        '🔔 {user} has been released. Try to behave... maybe.'
    ]);
    const comeback = msg[Math.floor(Math.random() * msg.length)].replace('{user}', `<@${target.id}>`);

    await channel?.send(comeback);
    interaction.reply({ content: `✅ ${target.tag} has been unhushed.`, ephemeral: true });
}