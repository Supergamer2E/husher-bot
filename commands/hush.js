export default async function(interaction, { userTimeouts, activeTimers, loadCustomComebacks, getTimeoutDuration, formatTime }) {
    const target = interaction.options.getUser('target');
    const corrector = interaction.options.getUser('corrector');
    const member = await interaction.guild.members.fetch(target.id);
    const duration = getTimeoutDuration(target.id);
    const offenses = userTimeouts[target.id];
    const channel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

    const reasons = [
      '⚖️ To pay for their crimes.',
      '🔨 Justice has been served.',
      '💥 Caught in 4K.',
      '🧹 Swept away to the timeout realm.',
      '🪓 Banned to the shadow realm (temporarily).',
      '⛏️ Mining their consequences in Minecraft.',
      '💎 Trying to steal diamonds... caught!',
      '🚪 Sent to the Nether.',
      '🐲 Failing to defeat the Ender Dragon.',
      '⚡ Expelled from Hogwarts for bad spells.',
      '🪄 Misusing a magic wand.',
      '📚 Cursed by the Book of Spells.',
      '🎩 Turned into a frog at the repo.',
      '📦 Failed the Repo Test.',
      '📜 Signed a cursed contract at the repo.',
      '👻 Haunted by repo ghosts.',
      '🚫 Banned from the server... briefly.',
      '👮‍♂️ Caught by the grammar police.',
      '🚓 Ticketed for speeding in chat.',
      '🎭 Guilty in the court of memes.',
      '🍕 Ate the last slice without asking.',
      '🎮 Rage-quitting Minecraft server.',
      '🧹 Swept into exile by the janitor bot.',
      '🧟‍♂️ Bitten by a timeout zombie.',
      '🛡️ Banished for bad behavior.'
    ];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];

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
            (corrector ? `**Corrected by:** <@${corrector.id}>\n` : '') +
            (success ? `**Time Remaining:** <t:${Math.floor((Date.now() + duration) / 1000)}:R>\n` : '*Could not apply timeout.*') +
            `**Offense Count This Week:** ${offenses}`,
        color: success ? 0x0000ff : 0xffa500,
        timestamp: new Date()
    };

    await channel?.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ ${success ? `Hushed` : `Failed to hush`} ${target.tag}.`, ephemeral: true });

    if (success && channel) {
        const timerMsg = await channel.send(`⏳ <@${target.id}> is in timeout for ${formatTime(duration / 1000)}.`);
        let timeLeft = duration / 1000;

        const interval = setInterval(async () => {
            timeLeft--;
            if (timeLeft > 0) {
                try {
                    await timerMsg.edit(`⏳ <@${target.id}> has ${formatTime(timeLeft)} remaining...`);
                } catch {}
            } else {
                clearInterval(interval);
                activeTimers.delete(target.id);
                try { await timerMsg.delete(); } catch {}
                const messages = loadCustomComebacks().concat([
                    '🧙 {user} has returned from the Forbidden Section of chat.',
                    '💬 {user} can speak again. The silence was nice.',
                    '🛏️ {user} has left the timeout dimension.',
                    '🎮 {user} has re-entered the game.',
                    '🔔 {user} has been released. Try to behave... maybe.'
                ]);
                const comeback = messages[Math.floor(Math.random() * messages.length)].replace('{user}', `<@${target.id}>`);
                await channel.send(comeback);
            }
        }, 1000);

        activeTimers.set(target.id, interval);
    }
}
