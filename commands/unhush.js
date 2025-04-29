export default async function(interaction, { userTimeouts, activeTimers, loadCustomComebacks }) {
    await interaction.deferReply({ ephemeral: true }); // acknowledge immediately

    const target = interaction.options.getUser('target');
    const reduce = interaction.options.getBoolean('reduce-offense');
    const member = await interaction.guild.members.fetch(target.id);
    const channel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

    if (activeTimers.has(target.id)) {
        clearInterval(activeTimers.get(target.id));
        activeTimers.delete(target.id);
    }

    try {
        await removeTimeout(member);
    } catch (e) {
        console.error('Failed to remove In Timeout role:', e);
    }

    if (reduce && userTimeouts[target.id]) {
        userTimeouts[target.id] = Math.max(0, userTimeouts[target.id] - 1);
    }

    const messages = loadCustomComebacks().concat([
        '🧙 {user} has returned from the Forbidden Section of chat.',
        '💬 {user} can speak again. The silence was nice.',
        '🛏️ {user} has left the timeout dimension.',
        '🎮 {user} has re-entered the game.',
        '🔔 {user} has been released. Try to behave... maybe.'
    ]);
    const comeback = messages[Math.floor(Math.random() * messages.length)].replace('{user}', `<@${target.id}>`);
    await channel?.send(comeback);

    await interaction.editReply({ content: `✅ ${target.tag} has been unhushed.` });
}
