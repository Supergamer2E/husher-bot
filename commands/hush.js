// File: commands/hush.js
export default async function(interaction, { userTimeouts, activeTimers, loadCustomComebacks, getTimeoutDuration, formatTime }) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const corrector = interaction.options.getUser('corrector');
    const member = await interaction.guild.members.fetch(target.id);
    const duration = getTimeoutDuration(target.id);
    const offenses = userTimeouts[target.id];
    const channel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

    let success = true;
    try {
        await member.timeout(duration, reason);
    } catch {
        success = false;
    }

    const embed = {
        title: success ? `🔇 ${target.tag} has been hushed!` : `⚠️ Tried to hush ${target.tag}`,
        description:
            `**Reason:** ${reason}\n` +
            (corrector ? `**Corrected by:** ${corrector}\n` : '') +
            (success ? `**Time Remaining:** <t:${Math.floor((Date.now() + duration) / 1000)}:R>\n` : '*Could not apply timeout.*') +
            `**Offense Count Today:** ${offenses}`,
        color: success ? 0x0000ff : 0xffa500,
        timestamp: new Date()
    };

    await channel?.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ ${success ? `Hushed` : `Failed to hush`} ${target.tag}.`, ephemeral: true });

    if (channel && success) {
        let timeLeft = duration / 1000;
        const timerMessage = await channel.send(`⏳ <@${member.id}> is in timeout for ${formatTime(timeLeft)}`);
        const comebackMessages = loadCustomComebacks().concat([
            '🧙 {user} has returned from the Forbidden Section of chat.',
            '💬 {user} can speak again. The silence was nice.',
            '🛏️ {user} has left the timeout dimension.',
            '🎮 {user} has re-entered the game.',
            '🔔 {user} has been released. Try to behave... maybe.'
        ]);

        const interval = setInterval(async () => {
            timeLeft--;
            if (timeLeft > 0) {
                await timerMessage.edit(`⏳ <@${member.id}> has ${formatTime(timeLeft)} remaining...`);
            } else {
                clearInterval(interval);
                activeTimers.delete(member.id);
                try { await timerMessage.delete(); } catch {}
                const msg = comebackMessages[Math.floor(Math.random() * comebackMessages.length)].replace('{user}', `<@${member.id}>`);
                await channel.send(msg);
            }
        }, 1000);

        activeTimers.set(member.id, interval);
    }
}
